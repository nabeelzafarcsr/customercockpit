sap.ui.define([
	"com/csr/customercockpit/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/csr/customercockpit/model/models",
	"com/csr/customercockpit/model/formatter",
	"sap/m/Dialog"
], function(BaseController, JSONModel, models, formatter, Dialog) {
	"use strict";

	return BaseController.extend("com.csr.customercockpit.controller.DocumentFlow", {

		onInit: function() {
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				isRetunOrder:false
			});
			this.setModel(oViewModel, "docFlowView");
			this.getRouter().getRoute("documentFlow").attachPatternMatched(this._onObjectMatched, this);
			
		},

		_onObjectMatched: function(oEvent) {
			this.sCustContextPath = oEvent.getParameter("arguments").custContextPath;
			this.selectedDocument = oEvent.getParameter("arguments").documentID;
			this.getDocumentsFlowData(this.selectedDocument);
		},

		getDocumentsFlowData: function(sSelectedDocument) {
			var sThat = this;
			//sSelectedDocument = "300005884"; //"300005842"; //"0033220940";"300005884";//
			var sContextPath = "/HeaderSet('" + sSelectedDocument + "')";
			var oViewModel = this.getModel("docFlowView");
			oViewModel.setProperty("/busy", true);
			oViewModel.setProperty("/isRetunOrder",false);
			this.getView().getModel().read(sContextPath, {
				urlParameters: {
					"$expand": "HeaderToDocflow"
				},
				success: function(data) {
					oViewModel.setProperty("/busy", false);
					sThat.jsonDataForProcessFlow(data.HeaderToDocflow.results);

				},
				error: function() {
					oViewModel.setProperty("/busy", false);
				}
			});
		},
	
		getRetunOrderDocumentFlow:function(sRetrunOrderId){
			this.getDocumentsFlowData(sRetrunOrderId);
		},
		
		handleBack: function() {
			this.getRouter().navTo("detail", {
				custContextPath: this.sCustContextPath
			}, true);
		},

		onNodePress: function(oEvent) {
			var selectedItem = oEvent.getParameters().getProperty("titleAbbreviation");
			if (selectedItem === "SO") {
				this.dialogForSoOper(oEvent);
			} else if (selectedItem === "DEL") {
				this.deliveryDocId = oEvent.getParameters().getProperty("nodeId");
				this.dialogForDeliveryOper(oEvent);
			} else if (selectedItem === "INV") {
				this.selectedInvoiceId = oEvent.getParameters().getProperty("nodeId");
				this.dialogForInvoiceOper(oEvent);
			}else if (selectedItem === "RT") {
				var returnOrderId = oEvent.getParameters().getProperty("nodeId");
				this.getRetunOrderDocumentFlow(returnOrderId);
			}
		},

		dialogForSoOper: function(oEvent) {
			if (!this._oDelPopover) {
				this._oDelPopover = sap.ui.xmlfragment("com.csr.customercockpit.view.fragment.DocumentFlowDeliveryDialog", this);
				this.getView().addDependent(this._oDelPopover);

			}
			var oDocIdLink = oEvent.getParameters();
			jQuery.sap.delayedCall(0, this, function() {
				this._oDelPopover.openBy(oDocIdLink);
			});
			this.setModel(models.createDocumentFlowSODialogModel(this), "docFlowDeliveryDialog");
		},

		dialogForInvoiceOper: function(oEvent) {
			if (!this._oPopover) {
				this._oPopover = sap.ui.xmlfragment("com.csr.customercockpit.view.fragment.DocumentFlowDialog", this);
				this.getView().addDependent(this._oPopover);

			}
			var oDocIdLink = oEvent.getParameters();
			jQuery.sap.delayedCall(0, this, function() {
				this._oPopover.openBy(oDocIdLink);
			});
			
			
			var sOrderType = this.getView().getModel("orderReturnModel").getProperty("/orderType");
			if ((sOrderType === "YQT") || (sOrderType === "YIR")) {
				this.setModel(models.docFlowPrintForInvoiceDialogModel(this), "docFlowDialog");
			} else {
				this.setModel(models.createDocumentFlowInvoiceDialogModel(this), "docFlowDialog");
			}

		},

		dialogForDeliveryOper: function(oEvent) {
			if (!this._oDelPopover) {
				this._oDelPopover = sap.ui.xmlfragment("com.csr.customercockpit.view.fragment.DocumentFlowDeliveryDialog", this);
				this.getView().addDependent(this._oDelPopover);

			}
			var oDocIdLink = oEvent.getParameters();
			jQuery.sap.delayedCall(0, this, function() {
				this._oDelPopover.openBy(oDocIdLink);
			});
			this.setModel(models.createDocumentFlowDeliveryDialogModel(this), "docFlowDeliveryDialog");
		},

		handlePopoverDeliveryList: function (oEvent) {
			var oBindingPath = oEvent.getSource().getBindingContextPath();
			var oActionKey = this.getModel("docFlowDeliveryDialog").getProperty(oBindingPath).key;
			var sOrderType = this.getView().getModel("orderReturnModel").getProperty("/orderType");
			var pickSlipIndicator = "PS";
			var deliveryDocketIndicator = "PD";
			if (sOrderType === "YIR") {
				pickSlipIndicator = "RS";
				deliveryDocketIndicator = "RD";
			}
			if (oActionKey === "PRINT_SLP") {
				this.triggerReceipt(this.deliveryDocId , pickSlipIndicator);
			} else if (oActionKey === "PRINT_DLV") {
				this.triggerReceipt(this.deliveryDocId , deliveryDocketIndicator);
			} else if (oActionKey === "PRINT_CONF") {
				this.triggerReceipt(this.selectedDocument, "OR");
			} else if (oActionKey === "PRINT_RECP") {
				this.triggerReceipt(this.selectedDocument, "PR");
			}
			this._oDelPopover.close();
		},
		handlePopoverInvoiceList: function(oEvent) {
			var oBindingPath = oEvent.getSource().getBindingContextPath();
			var oActionKey = this.getModel("docFlowDialog").getProperty(oBindingPath).key;
			if (oActionKey === "ORD_RETURN") {
				var isReturnOrderCreated = this.getView().getModel("docFlowView").getProperty("/isRetunOrder");
				if(isReturnOrderCreated){
					this.onApproveDialog();
				}else{
					this.getRouter().navTo("orderReturn", {
					documentID: this.selectedDocument,
					invoiceID: this.selectedInvoiceId,
					custContextPath: this.sCustContextPath
				}, true);
				}
				
			} else if (oActionKey === "PRINT") {
				this.triggerReceipt(this.selectedInvoiceId, "IN");
			} 
			this._oPopover.close();
		},
		
		onApproveDialog: function () {
			var sThat = this;
			var message = this.getResourceBundle().getText("returnOrderExistsMsg");
			var dialog = new Dialog({
				title: 'Confirm',
				type: 'Message',
				content: new sap.m.Text({ text: message }),
				beginButton: new sap.m.Button({
					text: 'Ok',
					press: function () {
						sThat.getRouter().navTo("orderReturn", {
					documentID: sThat.selectedDocument,
					invoiceID: sThat.selectedInvoiceId,
					custContextPath: sThat.sCustContextPath
				}, true);
						dialog.close();
					}
				}),
				endButton: new sap.m.Button({
					text: 'Cancel',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});
 
			dialog.open();
		},
		jsonDataForProcessFlow: function(sDataArray) {
			this.getModel("docFlowView").setProperty("/isRetunOrder",false);
			var nodes = [];
			var lanes = [];
			var soChildArray = [];
			var delChildArray = [];
			var invoiceChildArr = [];
			var returnChildArr = [];
			var sLaneId = 0;
			
			for (var index = 0; index < sDataArray.length; index++) {
				sLaneId = 0;
				var sItem = sDataArray[index];
				var node = {};
				if (sItem.Quotation || sItem.RefDoc) {
					if(sItem.RefDoc){
						node.id = sItem.RefDoc;
						node.titleAbbreviation = "REF";
						node.title = sItem.RefDoc;//sItem.RefDesc+" " + sItem.RefDoc;
						node.state = formatter.documentFlowStatus(sItem.RefCd);
						node.stateText = sItem.RefStatus;
					}else{
						node.id = sItem.Quotation;
						node.title = sItem.Quotation;//sItem.QuotationDesc +" " + sItem.Quotation;
						node.titleAbbreviation = "QT";
						node.state = formatter.documentFlowStatus(sItem.QuotationCd);
						node.stateText = sItem.QuotationStatus;
					}
					node.lane = sLaneId + ""; //+ "0";
					if (sItem.OrderNo) {
						soChildArray.push(sItem.OrderNo);
						node.children = soChildArray;
					} else {
						node.children = null;
					}
					node.isTitleClickable = false;
					node.focused = true;
					node.texts = [];
					if (nodes.length) {
						nodes = this.duplicateOrderNoCheck(nodes, node);
					} else {
						nodes.push(node);
					}
					sLaneId++; // = 1;
				}
				node = {};
				if (sItem.OrderNo) {
					node.id = sItem.OrderNo;
					node.lane = ((sLaneId === 1) ? 1 : 0) + ""; //"";//"1";
					node.title = sItem.OrderNo;//sItem.OrderDesc +" " + sItem.OrderNo;
					node.titleAbbreviation = "SO";
					if (sItem.DeliveryId) {
						if (delChildArray.length) {
							delChildArray = this.duplicateChildNodeCheck(delChildArray, sItem.DeliveryId);
						} else {
							delChildArray.push(sItem.DeliveryId);
						}

						node.children = delChildArray;
					} else {
						node.children = null;
					}
					node.isTitleClickable = false;
					node.state = formatter.documentFlowStatus(sItem.OrderStatusCd);
					node.stateText = sItem.OrderStatus;
					node.focused = true;
					node.texts = [];
					if (nodes.length) {
						nodes = this.duplicateOrderNoCheck(nodes, node);
					} else {
						nodes.push(node);
					}
					sLaneId++;
				}
				node = {};
				if (sItem.OrderNo && sItem.DeliveryId) {
					invoiceChildArr = [];
					node.id = sItem.DeliveryId;
					node.lane = ((sLaneId === 2) ? 2 : 1) + ""; //"2";
					node.title = sItem.DeliveryId;//sItem.DelDesc+" " + sItem.DeliveryId;
					node.titleAbbreviation = "DEL";
					if (sItem.InvoiceId) {
						invoiceChildArr.push(sItem.InvoiceId);
						node.children = invoiceChildArr;
					} else {
						node.children = null;
					}
					node.isTitleClickable = false;
					node.stateText = sItem.DelStatus;
					node.state = formatter.documentFlowStatus(sItem.DelStatusCd);
					if (nodes.length) {
						nodes = this.duplicateOrderNoCheck(nodes, node);
					} else {
						nodes.push(node);
					}
					sLaneId++;
					node = {};
				}
				if (sItem.DeliveryId && sItem.InvoiceId) {
					returnChildArr = [];
					node.id = sItem.InvoiceId;
					node.lane = ((sLaneId === 3) ? 3 : 2) + ""; //"3";
					node.title = sItem.InvoiceId;//sItem.InvoiceDesc+" " + sItem.InvoiceId;
					node.titleAbbreviation = "INV";
					if (sItem.ReturnId) {
						returnChildArr.push(sItem.ReturnId);
						node.children = returnChildArr;
					} else {
						node.children = null;
					}
					node.isTitleClickable = false;
					node.state = formatter.documentFlowStatus(sItem.InvoiceStatusCd);
					node.stateText = sItem.InvoiceStatus;
					node.texts = [];
					if (nodes.length) {
						nodes = this.duplicateOrderNoCheck(nodes, node);
					} else {
						nodes.push(node);
					}
					sLaneId++;
					node = {};
				}
				if (sItem.InvoiceId && sItem.ReturnId) {
					this.getModel("docFlowView").setProperty("/isRetunOrder",true);
					node.id = sItem.ReturnId;
					node.lane = ((sLaneId === 4) ? 4 : 3) + ""; //"3";
					node.title = sItem.ReturnId;//sItem.ReturnDesc+" " + sItem.ReturnId;
					node.titleAbbreviation = "RT";
					node.children = null;
					node.isTitleClickable = false;
					node.state = formatter.documentFlowStatus(sItem.ReturnStatusCd);
					node.stateText = sItem.ReturnStatus;
					node.texts = [];
					nodes.push(node);
					node = {};
				}
				sLaneId = 1;

			}
			if (sDataArray.length > 0) {
				sLaneId = 0;
				var bQote = false;
				var bOrder = false;
				var bDelivery = false;
				var bInvoice = false;
				var bReturn = false;
				for (var laneInd = 0; laneInd < sDataArray.length; laneInd++) {
					var lane = {};
					var item = sDataArray[laneInd];

					if ((item.Quotation || sItem.RefDoc) && !bQote) {
						bQote = true;
						lane.id = sLaneId + ""; //"0";
						lane.icon = "sap-icon://order-status";
						lane.label = item.Quotation ? item.QuotationDesc : item.RefDesc;
						lane.position = sLaneId; //0;
						lanes.push(lane);
						sLaneId++;
					}
					if ((item.OrderNo) && !bOrder) {
						bOrder = true;
						lane = {};
						lane.id = ((sLaneId === 1) ? 1 : 0) + ""; //"1";
						lane.icon = "sap-icon://order-status";
						lane.label = item.OrderDesc;
						lane.position = ((sLaneId === 1) ? 1 : 0); //1;
						lanes.push(lane);
						sLaneId++;
					}

					if ((item.DeliveryId) && !bDelivery) {
						bDelivery = true;
						lane = {};
						lane.id = ((sLaneId === 2) ? 2 : 1) + ""; //2";
						lane.icon = "sap-icon://monitor-payments";
						lane.label = item.DelDesc;
						lane.position = ((sLaneId === 2) ? 2 : 1); //2;
						lanes.push(lane);
						sLaneId++;
					}

					if ((item.DeliveryId && item.InvoiceId) && !bInvoice) {
						bInvoice = true;
						lane = {};
						lane.id = ((sLaneId === 3) ? 3 : 2) + ""; //"3";
						lane.icon = "sap-icon://payment-approval";
						lane.label = item.InvoiceDesc;
						lane.position = ((sLaneId === 3) ? 3 : 2); //3;
						lanes.push(lane);
						sLaneId++;
					}

					if ((item.InvoiceId && item.ReturnId) && !bReturn) {
						bReturn = true;
						lane = {};
						lane.id = ((sLaneId === 4) ? 4 : 3) + ""; //"3";
						lane.icon = "sap-icon://payment-approval";
						lane.label = item.ReturnDesc;
						lane.position = ((sLaneId === 4) ? 4 : 3); //3;
						lanes.push(lane);
					}
				}
			}
			var oDataProcessFlowLanesAndNodes = {};
			oDataProcessFlowLanesAndNodes.nodes = nodes;
			oDataProcessFlowLanesAndNodes.lanes = lanes;
			var oModelPf1 = new sap.ui.model.json.JSONModel();
			var viewPf1 = this.getView();
			oModelPf1.setData(oDataProcessFlowLanesAndNodes);
			viewPf1.byId("processflow1").setModel(oModelPf1, "documentProcess");
			viewPf1.byId("processflow1").updateModel();
		},

		duplicateOrderNoCheck: function(itemArr, item) {
			var bCheckDup = true;
			for (var itemIndex = 0; itemIndex < itemArr.length; itemIndex++) {
				var sItem = itemArr[itemIndex];
				if (sItem.id === item.id) {
					bCheckDup = false;
					itemArr[itemIndex] = item;
				}
			}
			if (bCheckDup) {
				itemArr.push(item);
			}
			return itemArr;
		},

		duplicateChildNodeCheck: function(itemArr, item) {
			var bCheckDup = true;
			for (var itemIndex = 0; itemIndex < itemArr.length; itemIndex++) {
				var sItem = itemArr[itemIndex];
				if (sItem === item) {
					bCheckDup = false;
					itemArr[itemIndex] = item;
				}
			}
			if (bCheckDup) {
				itemArr.push(item);
			}
			return itemArr;
		},
		triggerReceipt : function (documentNo, printIndicator) {
			var oThis = this;
			var oViewModel = this.getModel("docFlowView");
			var nacha = "1";
			var oModel = this.getModel();
			oModel.callFunction(
					"/PrintL", {
	                method: "POST",
	                urlParameters: {
						"Objky": documentNo,"Nacha": nacha ,"PrintInd": printIndicator, "Email": ""
	                },
					success: function (data) {
						oViewModel.setProperty("/busy", false);
						var message;
						if (data.PrintL.Done === true) {
							message = oThis.getResourceBundle().getText("printReceiptSuccess");
						} else {
							message = oThis.getResourceBundle().getText("printReceiptError");	
						}
						sap.m.MessageToast.show(
							message,
							{
								duration: 6000
							}
						);
						
					}, 
					error: function (error) {
						oViewModel.setProperty("/busy", false);
						var errorResponse = JSON.parse(error.responseText);
						var errorMessage = errorResponse.error.message.value;
						sap.m.MessageToast.show(
							errorMessage,
							{
								duration: 6000
							}
							);
					}
				}
            ); 
        }

	});

});