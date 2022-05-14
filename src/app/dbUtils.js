var mysql = require('mysql');
// Load the AWS SDK
const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const secretName = process.env.SECRET_NAME;
var secret;


// Create a Secrets Manager client
const client = new AWS.SecretsManager();
const CUSTOM_UNICORN_TABLE = "Custom_Unicorns";
const PARTNER_COMPANY_TABLE = "Companies";

/*
* Host
*/

const host = "secure-serverless-auroradbcluster-1d02qqgi38b7w.cluster-chhyxx0ew9iv.us-east-1.rds.amazonaws.com"

class Database {
    
    dbCredentials = null;

    query(sql, connection, args) {
        return new Promise((resolve, reject) => {
            connection.query(sql, args, (errorQuerying, rows) => {
                connection.end(errClosing => {
                        if (errClosing) {
                            console.log("error closing connection");
                            console.error(errClosing);
                        }
                        if (errorQuerying) {
                            return reject(errorQuerying);
                        }
                        resolve(rows);
                    }
                )
            });
        });
    }

    close(connection) {
        return new Promise((resolve, reject) => {
            connection.end(err => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }

    connectToDb(dbConfig) {
        return new Promise((resolve, reject) => {
            resolve(mysql.createConnection(dbConfig));
        });
    };

    getDbConfig() {
        console.log("getDbConfig()");
        if (!this.dbCredentials) {
            console.log(JSON.stringify({
                function: 'getDbConfig()',
                message: 'Getting new database credentials'}));
            this.dbCredentials = new Promise((resolve, reject) => {
                client.getSecretValue({SecretId: secretName}, function (err, data) {
                    if (err) {
                        this.dbCredentials = null;
                        console.error(err);
                        if (err.code === 'ResourceNotFoundException')
                            reject("The requested secret " + secretName + " was not found");
                        else if (err.code === 'InvalidRequestException')
                            reject("The request was invalid due to: " + err.message);
                        else if (err.code === 'InvalidParameterException')
                            reject("The request had invalid params: " + err.message);
                        else
                            reject(err.message);
                    }
                    else {
                        if (data.SecretString !== "") {
                            secret = data.SecretString;
                            resolve({
                                host: JSON.parse(secret).host,
                                user: JSON.parse(secret).username,
                                password: JSON.parse(secret).password,
                                database: "unicorn_customization",
                                ssl: "Amazon RDS",
    	                        multipleStatements: true
                            });
                        } else {
                            this.dbCredentials = null;
                            reject("Cannot parse DB credentials from secrets manager.");
                        }
                    }
                });
    
            });
        }
        return this.dbCredentials;
    };
    
    invalidateCredentials() {
        this.dbCredentials = null;
    }
}

function executeDBquery(query) {
    const dbConn = new Database();
    return dbConn.getDbConfig()
        .then(dbConn.connectToDb)
        .catch((err) => {
            dbConn.invalidateCredentials();
            console.error(JSON.stringify({
                message: "Could not connect to database",
                err: err
            }))
        })
        .then(dbConn.query.bind(this, query));
}

module.exports = {
    listBodyPartOptions: function (bodyPart) {
        const query = "SELECT * FROM " + bodyPart;
        console.log("query for DB: " + query);
        return executeDBquery(query);
    },


    addPartnerCompany: function (companyName) {
        const insertQuery = "INSERT INTO " + PARTNER_COMPANY_TABLE + " (NAME) VALUES ('" + companyName + "');";
        console.log("query for insert:" + insertQuery);

        return executeDBquery(insertQuery).then(results => {
            console.log(JSON.stringify(results, null, 2));
            let insertId = results.insertId;
            console.log("insert id: " + insertId);
            return {"companyId": insertId};
        })
    },

    createCustomUnicorn: function (name, company, imageUrl, sock, horn, glasses, cape) {
        const dbConn = new Database();
        const insertQuery = "INSERT INTO " + CUSTOM_UNICORN_TABLE + " (NAME, COMPANY, IMAGEURL, SOCK, HORN, GLASSES, CAPE) VALUES ('" + name + "'," + company + ",'" + imageUrl + "'," + sock + "," + horn + "," + glasses + "," + cape + ");";
        console.log("query for insert:" + insertQuery);

        return dbConn.getDbConfig()
            .then(dbConn.connectToDb)
            .then(dbConn.query.bind(this, insertQuery)).then(results => {
                console.log(JSON.stringify(results, null, 2));
                let insertId = results.insertId;
                console.log("insert id: " + insertId);
                return {"customUnicornId": insertId};
            });
    },

    listCustomUnicorn: function (company) {
        var query = "SELECT * FROM " + CUSTOM_UNICORN_TABLE;
        console.log("query for compa" + company)
        if (company !== null && company !== undefined && company !== "") {
            query += " WHERE COMPANY = " + company;
        }
        console.log("query for DB: " + query);
        return executeDBquery(query);
    },

    getCustomUnicorn: function (id, company) {
        var query = "SELECT * FROM " + CUSTOM_UNICORN_TABLE + " WHERE ID = " + id;
        if (company !== null && company !== undefined && company !== "") {
            query += " AND COMPANY = " + company;
        }
        console.log("query for DB: " + query);
        return executeDBquery(query);
    },

    deleteCustomUnicorn: function (id, company) {
        var query = "DELETE FROM " + CUSTOM_UNICORN_TABLE + " WHERE ID = " + id;
        if (company !== null && company !== undefined && company !== "") {
            query += " AND COMPANY = " + company;
        }
        console.log("query for DB: " + query);
        return executeDBquery(query).then(results => {
            if (results.affectedRows == 1) {
                return {"id": id};
            } else {
                return {};
            }
        });
    }

}


