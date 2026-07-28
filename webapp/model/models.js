sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device"
], function (JSONModel, Device) {
	"use strict";

	return {

		createDeviceModel: function () {
			var oModel = new JSONModel(Device);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},
		createDocumentDialogModel: function (isPaymentPaid, isPaymentPaidFull, status) {
			var dialogArray = [];
			var editKeyDetails = {};
			var receivePaymentDetails = {};
			var documentFlowDetails = {};
			if (!isPaymentPaid && status !== "C") {
				editKeyDetails.text = "Edit";
				editKeyDetails.iconUrl = "sap-icon://edit";
			} else {
				editKeyDetails.text = "Display";
				editKeyDetails.iconUrl = "sap-icon://display";
			}
			editKeyDetails.key = "EDIT";
			dialogArray.push(editKeyDetails);

			if (isPaymentPaidFull !== "X" && status !== "C") {
				receivePaymentDetails.text = this.getResourceBundle().getText("receivePayment");
				receivePaymentDetails.key = "REC_PAY";
				receivePaymentDetails.iconUrl = "sap-icon://batch-payments";
				dialogArray.push(receivePaymentDetails);
			}

			documentFlowDetails.text = this.getResourceBundle().getText("docFlow");
			documentFlowDetails.key = "DOC_FLOW";
			documentFlowDetails.iconUrl = "sap-icon://process";
			dialogArray.push(documentFlowDetails);
			var oModel = new JSONModel(dialogArray);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;

		},
		createDocumentListDialogModel: function (orderType) {
			var receiveText = this.getResourceBundle().getText("receivePayment");
			var docFlowText = this.getResourceBundle().getText("docFlow");
			var editText = "Edit";
			if (orderType === "YIO") {
				editText = "Display";
			}
			var oModel = new JSONModel(
				[{
					text: editText,
					iconUrl: "sap-icon://edit",
					key: "EDIT"
				}, {
					text: receiveText,
					iconUrl: "sap-icon://batch-payments",
					key: "REC_PAY"
				}, {
					text: docFlowText,
					iconUrl: "sap-icon://process",
					key: "DOC_FLOW"
				}]
			);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},
		createEditDocumentFlowDialogModel: function (orderType) {
			var docFlowText = this.getResourceBundle().getText("docFlow");
			var editText = "Edit";
			if (orderType === "YIO") {
				editText = "Display";
			}
			var oModel = new JSONModel([{
				text: editText,
				iconUrl: "sap-icon://edit",
				key: "EDIT"
			}, {
				text: docFlowText,
				iconUrl: "sap-icon://process",
				key: "DOC_FLOW"
			}]);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},
		createDocumentFlowInvoiceDialogModel: function (sThat) {
			var printText = sThat.getResourceBundle().getText("print");
			var docFlowText = sThat.getResourceBundle().getText("ordReturn");
			var oModel = new JSONModel([{
				text: printText,
				iconUrl: "sap-icon://print",
				key: "PRINT"
			}, {
				text: docFlowText,
				iconUrl: "sap-icon://undo",
				key: "ORD_RETURN"
			}]);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},

		docFlowPrintForInvoiceDialogModel: function (sThat) {
			var printText = sThat.getResourceBundle().getText("print");
			var oModel = new JSONModel([{
				text: printText,
				iconUrl: "sap-icon://print",
				key: "PRINT"
			}]);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},
		createChangeOrderHeaderModel: function () {
			var oModel = new JSONModel({});
			oModel.setDefaultBindingMode("TwoWay");
			return oModel;
		},
		createChangeOrderDeleteItemsModel: function () {
			var oModel = new JSONModel({});
			oModel.setDefaultBindingMode("TwoWay");
			return oModel;
		},
		createDocumentFlowDeliveryDialogModel: function (sThat) {
			var printText = sThat.getResourceBundle().getText("prntPick");
			var docFlowText = sThat.getResourceBundle().getText("prntDelDocket");
			var oModel = new JSONModel([{
				text: printText,
				iconUrl: "sap-icon://print",
				key: "PRINT_SLP"
			}, {
				text: docFlowText,
				iconUrl: "sap-icon://print",
				key: "PRINT_DLV"
			}]);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},

		createDocumentFlowSODialogModel: function (sThat) {
			var prntConf = sThat.getResourceBundle().getText("prntConf");
			var prntReceipt = sThat.getResourceBundle().getText("prntReceipt");
			var oModel = new JSONModel([{
				text: prntConf,
				iconUrl: "sap-icon://print",
				key: "PRINT_CONF"
			}, {
				text: prntReceipt,
				iconUrl: "sap-icon://print",
				key: "PRINT_RECP"
			}]);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},

		createOrderReturnModel: function () {
			var oModel = new JSONModel({
				"returnDate": new Date(),
				"orderType": ""
			});
			oModel.setDefaultBindingMode("TwoWay");
			return oModel;
		},
		createBPointModel: function () {
			var oModel = new JSONModel({
				"protocol": "https://",
				"host": "bpoint.uat.linkly.com.au", //"bpoint-uat.premier.com.au",
				"path": "/webapi/v3/txns/iframe/",
				"authKey": "",
				"liveHost":"www.bpoint.com.au"
			});
			oModel.setDefaultBindingMode("TwoWay");
			return oModel;
		}

	};
});