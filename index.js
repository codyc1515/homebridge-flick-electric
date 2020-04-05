var Service;
var Characteristic;

var request = require("request");

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;

    homebridge.registerAccessory("homebridge-flick-electric", "FlickElectric", FlickElectric);
};

function FlickElectric(log, config) {
    this.log = log;
    this.name = config["name"] || "Flick Electric";
    this.token = config["token"];
    this.email = config["email"];
    this.password = config["password"];
    this.debug = config["debug"] || false;

    this.CurrentPrice = null;

    // Start running the refresh process
    try {
        // Get the data initially
        this._refresh();

        // Refresh periodically
        setInterval(function() {this._refresh();}.bind(this), 600000);
    }
    catch(err) {this.log("An unknown error occured", err);}
}

FlickElectric.prototype = {

    identify: function(callback) {
        this.log("identify");
        callback();
    },

    _refresh: function() {
        if(this.debug) {this.log("Refresh price");}

        request.get({
            url: "https://api.flick.energy/customer/mobile_provider/price",
            auth: {
                bearer: this.token
            }
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                try {
                    body = JSON.parse(body);

                    if(body.kind === "mobile_provider_price") {
                        // Find & set the CurrentTemperature
                        this.CurrentTemperature = body.needle.price;

                        if(this.debug) {console.log('Obtained pricing successfully', body, this.CurrentTemperature);}

                        this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.CurrentTemperature);
                    }
                    else {this.log("Could not process pricing response");}
                }
                catch {this.log("Could not process pricing response");}
            }
            else {this.log("Failed to obtain pricing", err, response, body);}
        }.bind(this));
    },

    getServices: function() {
        this.TemperatureSensor = new Service.TemperatureSensor(this.name);
        this.TemperatureSensor
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
				minValue: 0,
				maxValue: 1000,
				minStep: 0.001
			})
            .on('get', this._getValue.bind(this, "CurrentTemperature"));

        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, "Flick Electric")
            .setCharacteristic(Characteristic.Model, "Freestyle")
            .setCharacteristic(Characteristic.FirmwareRevision, "1.0.0");

        return [
            this.TemperatureSensor,
            this.informationService
        ];
    },

    _getValue: function(CharacteristicName, callback) {
        if(this.debug) {this.log("GET", CharacteristicName);}

        switch (CharacteristicName) {

            case "CurrentTemperature":
                this._refresh();
                callback(null, this.CurrentTemperature);
            break;

            default:
                this.log("Unknown CharacteristicName called", CharacteristicName);
                callback();
            break;
        }
    }

};
