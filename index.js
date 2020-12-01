var Service,
	Characteristic;

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
    this.debug = config["debug"] || false;

	this.import = 0;
	this.export = 0;

    // Start running the refresh process
    try {
        // Get the data initially
        this._refresh();

        // Refresh periodically
        setInterval(function() {
			this._refresh();
		}.bind(this), 600000);
    }
    catch(err) {this.log("An unknown error occured", err);}
}

FlickElectric.prototype = {

    identify: function(callback) {
        this.log("identify");
        callback();
    },

    getServices: function() {
		// Light Sensor service - Import
		this.LightSensorImport = new Service.LightSensor(this.name + " Import", "Import");
		this.LightSensorImport
			.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
			.setProps({
				minValue: 0,
				maxValue: 10000,
				minStep: 0.01
			});

		// Light Sensor service - Export
		this.LightSensorExport = new Service.LightSensor(this.name + " Export", "Export");
		this.LightSensorExport
			.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
			.setProps({
				minValue: 0,
				maxValue: 10000,
				minStep: 0.01
			});

		// Accessory Information service
        this.AccessoryInformation = new Service.AccessoryInformation();
        this.AccessoryInformation
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, "Flick Electric")
            .setCharacteristic(Characteristic.Model, "Freestyle")
            .setCharacteristic(Characteristic.FirmwareRevision, "1.0.0");

        return [
			this.AccessoryInformation,
			this.LightSensorImport,
			this.LightSensorExport
        ];
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
						// Get the Import price and add GST
						this.import = body.needle.price * 1.15;
                        if(this.debug) {this.log("Import price", this.import);}

                        this.LightSensorImport.getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(this.import);

						// Get the Export price
						for (var i = 0, len = body.needle.components.length; i < len; i++) {
							if(body.needle.components[i].charge_setter == 'generation') {
								this.export = body.needle.components[i].value;
								if(this.debug) {this.log("Export price", this.export);}

								this.LightSensorExport.getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(this.export);
							}
						}
                    }
                    else {this.log("Could not process pricing response");}
                }
                catch {this.log("Could not process pricing response");}
            }
            else {this.log("Failed to obtain pricing", err, response, body);}
        }.bind(this));
    },

    _getValue: function(CharacteristicName, callback) {
        if(this.debug) {this.log("GET", CharacteristicName);}
		callback(null);
    }

};
