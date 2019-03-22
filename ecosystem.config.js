module.exports = {
//this is pm2configuration, derived from:
// https://stackoverflow.com/questions/31579509/can-pm2-run-an-npm-start-script
    "apps": [
        {
            "name": "pcapviz",
            "script": "npm",
            "args" : "start"
        }
    ]
}
