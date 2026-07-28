// jQuery.sap.declare("com.csr.customercockpit.model.formatter");
jQuery.sap.require("sap.ui.core.format.DateFormat");
sap.ui.define([], function() {
	"use strict";

	var formatter = {

		currencyValue: function(sValue) {
			if (!sValue) {
				return "";
			}

			return parseFloat(sValue).toFixed(2);
		},
		concatenateAddressString: function(sStreet, sStrSuppl1, sCity1, sPostCode1) {
			var sStr = "";
			var bValue = false;
			if (sStreet) {
				sStr = sStreet;
				bValue = true;
			}
			if (sStrSuppl1) {
				if (bValue) {
					sStr += " , " + sStrSuppl1;
				} else {
					sStr += sStrSuppl1;
					bValue = true;
				}
			}
			if (sCity1) {
				if (bValue) {
					sStr += " , " + sCity1;
				} else {
					sStr += sCity1;
					bValue = true;
				}
			}
			if (sPostCode1) {
				if (bValue) {
					sStr += " , " + sPostCode1;
				} else {
					sStr += sPostCode1;
					bValue = true;
				}
			}

			if (bValue) {
				return sStr;
			} else {
				return "";
			}

		},
		dateFormatting: function(value) {
			if (value) {
				var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
					pattern: "dd/MM/yyyy"
				});
				return oDateFormat.format(new Date(value));
			} else {
				return value;
			}
		},
		getItemDate: function(dateValue) {
			if (dateValue) {
				return new Date(dateValue);
			}
			return "";
		},
		formatItemStatus: function(statusCode) {
			if (statusCode === "A") {
				return "None";
			} else if (statusCode === "B") {
				return "Warning";
			} else if (statusCode === "C") {
				return "Success";
			} else {
				return "None";
			}

		},
		formatDate: function(value) {
			var currentDate = new Date(value);
			var year = currentDate.getFullYear();
			var date = currentDate.getDate();
			var month = currentDate.getMonth() + 1;
			return year + "-" + month + "-" + date + "T00:00:00";
		},
		isQuantityEligibleForEdit: function(statusCode, isPaymentPaid, is3rdParty) {
			if (statusCode !== "C" && isPaymentPaid === "false" && is3rdParty !== "X") {
				return true;
			}
			return false;
		},
		isQuantityEligibleForDisplay: function(statusCode, isPaymentPaid, is3rdParty) {
			if (statusCode !== "C" && isPaymentPaid === "false" && is3rdParty !== "X") {
				return false;
			}
			return true;
		},
		isItemEligibleForEdit: function(statusCode, isPaymentPaid, is3rdParty) {
			if (statusCode !== "C" && isPaymentPaid === "false" && is3rdParty !== "X") {
				return true;
			}
			return false;

		},
		isItemEligibleForDisplay: function(statusCode, isPaymentPaid, is3rdParty) {
			if (statusCode !== "C" && isPaymentPaid === "false" && is3rdParty !== "X") {
				return false;
			}
			return true;

		},
		displayDeleteValue: function(statusCode, materialDesc, isPaymentPaid, is3rdParty) {
			if (statusCode !== "C" && materialDesc && isPaymentPaid === "false" && is3rdParty !== "X") {
				return true;
			}
			return false;

		},
		formatDiscount: function(discount, discountType, unitOfMeasure) {
			if (discountType === "AUD" && discount) {
				return ["$",discount,unitOfMeasure].join(" ");
			} else if (discount && discountType) {
				return [discount,discountType].join(" ");
			} else {
				return "";
			}
		},
		displayCurrencyUnit: function(discountType) {
			if (discountType === "AUD") {
				return "$";
			}
			return "";
		},
		enableAddButton: function(statusCode, isPaymentPaid) {
			if (statusCode !== "C" && isPaymentPaid === "false") {
				return true;
			}
			return false;
		},
		enableField: function(sValue) {
			if (sValue === "YQT") {
				return false;
			}
			return true;
		},
		formatSO: function(salesOrderNo, orderType) {
			if (orderType === "YQT") {
				return "QT " + salesOrderNo;
			} else if (orderType === "YIO") {
				return "IO " + salesOrderNo;
			} else if (orderType === "YOR") {
				return "SO " + salesOrderNo;
			} else if (orderType === "YIR") {
				return "RT " + salesOrderNo;
			} else if (orderType === "YIS") {
				return "WB " + salesOrderNo;
			} else if (orderType === "YRE") {
				return "SR " + salesOrderNo;
			}

		},

		documentFlowStatus: function(sStatusCode) {
			if ((sStatusCode === "A") || (sStatusCode === "O")) {
				return sap.suite.ui.commons.ProcessFlowNodeState.PlannedNegative;
			} else if (sStatusCode === "B") {
				return sap.suite.ui.commons.ProcessFlowNodeState.Negative;
			} else if (sStatusCode === "C") {
				return sap.suite.ui.commons.ProcessFlowNodeState.Positive;
			} else {
				return sap.suite.ui.commons.ProcessFlowNodeState.Planned;
			}
		},

		templateForDocLineItems: function(that) {
			var oTemplate = new sap.m.ColumnListItem({
				cells: [
					new sap.m.ObjectStatus({
						icon:"sap-icon://locked", 
						state:"Error",
						visible:
						{
						 	path:"Lifsk",
						 	formatter: formatter.isDeliveryBlockVisible
						}
					}),
					new sap.m.Link({
						text: "{OrderType} {OrderNo}",
						emphasized: true,
						press: function(oEvent) {
							that.handleDocumnetIdPressed(oEvent);

						}
					}),
					new sap.m.Text({
						text: "{CustomerPo}"
					}),
					new sap.m.Text({
						text: "{StatusText}"
					}),
					new sap.m.Text({
						text: "{CreatedBy}"
					}),

					new sap.m.Text({
						text: {
							path: "CreatedOn",
							formatter: formatter.dateFormatting
						}
					}),
					/*new sap.m.Text({
						text: "{i18n>detailCurrency}{NetAmount}"
					}).addStyleClass('detailBoldFont')*/
					new sap.m.Text({
						text: {
							parts:[{path:"i18n>detailCurrency"}, {path:"NetAmount"}],
							formatter: formatter.formatItemAmount
						}
					}).addStyleClass('detailBoldFont')
				]
			});

			return oTemplate;
		},
		checkVisibilityBillingIcon: function(sValue, sThis) {
			var iconId = sThis.oView.byId("billingId");
			formatter.checkVisibilityForDeliveryAndBilling(sValue, iconId);
		},
		checkVisibilityForClubGyprockIcon: function(sObject, sThis) {
			var iconId = sThis.oView.byId("clubGyprockAcId");
			var iconPcId = sThis.oView.byId("clubGyprockPcId");
			if (iconId.hasStyleClass("clubGyprockIconRedColor")) {
				iconId.removeStyleClass("clubGyprockIconRedColor");
			}
			if (iconPcId.hasStyleClass("clubGyprockIconHalfRedColor")) {
				iconPcId.removeStyleClass("clubGyprockIconHalfRedColor");
			}
			iconId.setVisible(false);
			iconPcId.setVisible(false);
			if (sObject.ZzclubGyprock === "AC") {
				iconId.setVisible(true);
				iconId.addStyleClass("clubGyprockIconRedColor");
			} else if (sObject.ZzclubGyprock === "PC") {
				iconPcId.setVisible(true);
				iconPcId.addStyleClass("clubGyprockIconHalfRedColor");
			}
		},
		checkVisibilityPaymentTermIcon: function(sValue, sThis) {
			var iconId = sThis.oView.byId("moneyBillId");
			if (iconId.hasStyleClass("clubGyprockIconRedColor")) {
				iconId.removeStyleClass("clubGyprockIconRedColor");
			}
			if (sValue && (sValue === 'CASH' || sValue === 'COD')) {
				iconId.setVisible(false);
			} else if (sValue) {
				iconId.setVisible(true);
				iconId.addStyleClass("clubGyprockIconRedColor");
			} else {
				iconId.setVisible(false);
			}
		},

		checkVisibilityDeliveryIcon: function(sValue, sThis) {
			var iconId = sThis.oView.byId("shippingId");
			formatter.checkVisibilityForDeliveryAndBilling(sValue, iconId);
		},

		checkVisibilityForDeliveryAndBilling: function(sValue, sIcon) {
			if (sIcon.hasStyleClass("clubGyprockIconBlueColor")) {
				sIcon.removeStyleClass("clubGyprockIconBlueColor");
			}
			if (!sValue) {
				sIcon.setVisible(true);
				sIcon.addStyleClass("clubGyprockIconBlueColor");
			} else {
				sIcon.setVisible(false);
			}
		},
		formatCurrency: function(currencyType, currencyValue) {
			var currency = "";
			if (currencyType === "AUD") {
				currency = "$ ";
			}
			if (currencyValue) {
				currencyValue = parseFloat(currencyValue).toLocaleString(undefined, {minimumFractionDigits: 2});
				//currencyValue = parseFloat(currencyValue).toFixed(2);
				return [currency, currencyValue].join(" ");
			}
			return "";
		},
		displaySaveOrderText: function(payableAmount) {
			if (payableAmount) {
				var amount = parseFloat(payableAmount);
				if (amount > 0) {
					return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("saveWithoutFullPayment");
				} else {
					return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("save");
				}
			}
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("saveWithoutFullPayment");
		},
		displayTotalAmountText: function(action) {
			var displayText = this.getResourceBundle().getText("dueAmount");
			if (action === "returnOrder") {
				displayText = this.getResourceBundle().getText("salesOrderAmount");
			}
			return displayText;
		},
		displayPaidAmountText: function(action) {
			var displayText = this.getResourceBundle().getText("paidAmount");
			if (action === "returnOrder") {
				displayText = this.getResourceBundle().getText("returnedAmount");
			}
			return displayText;
		},
		displayPayableAmountText: function(action) {
			var displayText = this.getResourceBundle().getText("payableAmount");
			if (action === "returnOrder") {
				displayText = this.getResourceBundle().getText("refundAmount");
			}
			return displayText;
		},
		enable3rdParty: function(orderType) {
			if (orderType === "YOR1" || orderType === "YOR") {
				return true;
			}
			return false;
		},
		enableUpdateOrderButton: function(statusCode, isPaymentPaid) {
			if (statusCode !== "C" && isPaymentPaid === "false") {
				return true;
			}
			return false;

		},
		displayCashPaidText: function(action, isEditable) {
			var textValue = this.getResourceBundle().getText("paid");
			if (action === "returnOrder" && !isEditable && isEditable !== false) {
				textValue = this.getResourceBundle().getText("refund");
			}
			return textValue;
		},

		setClubGyprockStatusFullStar: function(sValue) {
			if (sValue) {
				// apply css 
				if (sValue === "AC") {
					return true;
				} else {
					return false;
				}
			}
			return false;
		},

		setClubGyprockStatusHalfStar: function(sValue) {
			if (sValue) {
				// apply css 
				if (sValue === "PC") {
					return true;
				} else {
					return false;
				}
			}
			return false;
		},
		changeOrderText: function(salesOrderID, orderType, isPaymentPaid) {
			var msg = null;
			if (orderType === "YQT") {
				if (isPaymentPaid === "true") {
					msg= this.getResourceBundle().getText("displayQuoteText", [salesOrderID]);
				} else {
					msg =  this.getResourceBundle().getText("changeQuoteText", [salesOrderID]);
				}
					
			} else {
				if (isPaymentPaid === "true") {
					msg = this.getResourceBundle().getText("displayOrderText", [salesOrderID]);
				} else {
					msg = this.getResourceBundle().getText("changeOrderText", [salesOrderID]);
				}
					
			}
			return msg;
			
		},
		updateOrderText: function (orderType) {
			if (orderType === "YQT") {
				return this.getResourceBundle().getText("updateQuote");
			}
			return this.getResourceBundle().getText("updateOrder");
		
		},
		displayAlertIcon: function(quantity, confirmedQty) {
			if (quantity && (confirmedQty === 0 || confirmedQty)) {
				if (parseInt(confirmedQty, 10) < parseInt(quantity, 10)) {
					return true;
				}
			}
			return false;
		},
		isPORequired: function(isPORequiredValue) {
			if (isPORequiredValue === "Y") {
				return true;
			}
			return false;
		},
		enablePurchaseOrder: function(statusCode, isPaymentPaid) {
			if (statusCode !== "C" && isPaymentPaid === "false") {
				return true;
			}
			return false;
		},
		isDeliveryBlockVisible: function (deliveryBlock) {
			if (deliveryBlock) {
				return true;
			}
			return false;
		},
		displayItemText: function (islandscape) {
        	var deviceModel = this.getOwnerComponent().getModel("device");
        	var isDesktop = deviceModel.getProperty("/system/desktop");
        	if (isDesktop) {
        		return true;
        	} else if (!isDesktop && !islandscape) {
        		return true;
        	} 
        	return false;
        },
        displaySalesUnitList: function (salesUnitList, discountType) {
        	if (salesUnitList && discountType === "AUD") {
        		return true;
        	}
        	return false;
        },
        formatItemAmount: function (unit, amount) {
        	var amountValue = "";
			if (amount) {
				amountValue = formatter.formatItemCurrency(amount);
			}
			if (unit) {
				amountValue = [unit, amountValue].join(" ");
			}
			return amountValue;
		},
		formatItemCurrency: function (amount) {
			var amountValue = "";
			if (amount) {
				amountValue = parseFloat(amount).toLocaleString(undefined, {minimumFractionDigits: 2});
				//amountValue = parseFloat(amount).toFixed(2);
			}
			return amountValue;
		},
		formatItemConfQty: function (Qty, salesUnit) {
			if (Qty) {
				Qty = parseInt(Qty, 10).toLocaleString();
			} else {
				Qty = "";
			}
			return [Qty, salesUnit].join(" ");
		},
		formatQty: function (Qty) {
			if (Qty) {
				Qty = parseInt(Qty, 10).toLocaleString();
			} else {
				Qty = "";
			}
			return Qty;
		},
		formatWeightAndArea: function (value, unit) {
        	if (value) {
				value = parseFloat(value).toLocaleString(undefined, {minimumFractionDigits: 3});
			}
			return [value, unit].join(" ");
        },
        formatProductStock: function (value, unit) {
        	value = formatter.formatItemConfQty(value, unit);
        	return value;
        },
        formatAmount: function (amount, unit) {
        	var amountValue = "";
        	if (amount) {
        		amountValue = formatter.formatItemCurrency(amount);
        	}
        	
        	return [amountValue, unit].join(" ");
		},
		//------------------ chages for BPoint and Pinpad button visibility WRT txnsrc and region(ex: AU) From: C5265889
		formatBPointRefundBtnVisible:function(sTxnSrc,sCountryCode){
			var bFlag = false;
			if(sTxnSrc === "B"){
				bFlag = true;
			}else if(sTxnSrc === "BP" && sCountryCode === "AU"){
				bFlag = true;
			}
			return bFlag;
		},
		formatPinpadRefundBtnVisible:function(sTxnSrc){
			var bFlag = true;
			if(sTxnSrc === "B"){
				bFlag = false;
			}else if(sTxnSrc === "BP"){
				bFlag = true;
			}
			return bFlag;
		},
		formatTxnText:function(sTxnSrc){
			var sTxt = sTxnSrc;
			if(sTxnSrc === "P" || sTxnSrc === "BP"){
				sTxt = "Pinpad";
			}
			return sTxt;
		}
	};

	return formatter;

});