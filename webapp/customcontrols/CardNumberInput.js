sap.ui.define([
	"sap/m/Input"
], function(oInputCtr) {
	"use strict";

	return oInputCtr.extend("com.csr.customercockpit.customcontrols.CardNumberInput", {

		metadata: {
			properties: {
				"regex" : {type:"string",defaultValue:'^[0-9]{1,4}$'},
				"actualValue": {type:"string", defaultValue:''}
			},
			events: {
			}
		},
		renderer: function(oRm, oControl) {
			sap.m.InputRenderer.render(oRm, oControl);
		},

		onAfterRendering: function(){
            if (sap.m.Input.prototype.onAfterRendering) {
            sap.m.Input.prototype.onAfterRendering.apply(this);
          }
            var regex = new RegExp(this.getRegex());
            var oInput = $("#" + this.getId() + " input")[0];
            $("#"+this.getId()).bind('keypress', function (event) {
            	var value = oInput.value;
            	var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
            	var enteredText = value+key;
                if (!regex.test(enteredText)) {
                  event.preventDefault();
                  var targetID;
                  if (this.id.indexOf("num1") !== -1) {
                  	targetID = this.id.replace("num1", "num2");
                  } else if (this.id.indexOf("num2") !== -1) {
                  	targetID = this.id.replace("num2", "num3");
                  } else if (this.id.indexOf("num3") !== -1) {
                  	targetID = this.id.replace("num3", "num4");
                  }
                  $("#"+targetID).find("input").focus();
                  $("#"+targetID).find("input").val(key);
                  return false;
                } 
            });

		}
	});

});