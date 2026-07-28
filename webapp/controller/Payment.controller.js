/*Change History
 ***********************************************************************
 * Date         Incident      Author      Description
 * --------    -----------  ---------    ------------------
 *03/08/2017   384813/2017   I327900     auto save on order return added
 *11/08/2017   392470/2017   I327900     credit card refund bug
 *20/01/2018	  21056/2018    I327900     ePOS order save with partial payment
 *25/05/2018   266670/2018   C5253525    ePOS payment split error
 *27/011/2020				 C5265889    BPoint refund and payment integration
 ***********************************************************************
 */

sap.ui.define([
	"com/csr/customercockpit/controller/BaseController",
	"com/csr/customercockpit/model/formatter",
	"com/csr/customercockpit/util/OrderServiceUtil",
	"com/csr/customercockpit/model/models",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/HTML",
	"sap/m/Dialog",
	"sap/m/DialogType",
	"sap/m/Button",
	"sap/m/ButtonType"
], function (BaseController, formatter, OrderServiceUtil, models, JSONModel, MessageBox, MessageToast, Html, Dialog, DialogType, Button,
	ButtonType) {
	"use strict";

	return BaseController.extend("com.csr.customercockpit.controller.Payment", {

		formatter: formatter,
		OrderServiceUtil: OrderServiceUtil,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.csr.order.view.Payment
		 */
		onInit: function () {
			var oViewModel = this.createViewModel();
			var customerOrderViewModel = new JSONModel({});
			this.getView().setModel(oViewModel, "paymentViewModel");
			this.getView().setModel(customerOrderViewModel, "customerOrderViewModel");
			this.getOwnerComponent().getRouter().getRoute("payment").attachPatternMatched(this.onObjectMatched, this);

		},
		createViewModel: function () {
			return new JSONModel({
				"delay": 0,
				"busy": false,
				"CardSet": [{}],
				"CashSet": [{}, {}],
				"PrintReceipt": true,
				"EmailReceipt": false,
				"changeAmount": 0,
				"displayBackButton": true

			});
		},
		onObjectMatched: function (oEvent) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", true);
			this.sCustContextPath = oEvent.getParameter("arguments").custContextPath;
			this.paymentInd = oEvent.getParameter("arguments").paymentInd;
			var email = this.getModel().getProperty("/" + this.sCustContextPath).SmtpAddr;
			var selectedDocument = oEvent.getParameter("arguments").documentID;
			this.triggerGetOrderDetails(selectedDocument);
			var queryParameters = oEvent.getParameter("arguments")["?query"];
			if (queryParameters) {
				this.action = queryParameters.action;
				this.invoiceId = queryParameters.invoiceID;
				oViewModel.setProperty("/action", this.action);
				if (queryParameters.dueAmount) {
					oViewModel.setProperty("/totalAmount", queryParameters.dueAmount.trim());
				} else if (queryParameters.returnOrderedAmount) {
					oViewModel.setProperty("/paid", queryParameters.returnOrderedAmount);
					oViewModel.setProperty("/payableAmount", queryParameters.returnOrderedAmount);
				}
			}
			this.triggerGetOrderPaymentDetails(selectedDocument);
			oViewModel.setProperty("/vbeln", selectedDocument);
			oViewModel.setProperty("/email", email);

			if (!this.action || this.action === this.getResourceBundle().getText("actionChangeOrder") ||
				this.action === this.getResourceBundle().getText("actionReceivePayment")) {
				oViewModel.setProperty("/paymentVbeln", selectedDocument);
			}

			this.getAssestID();
			this.createMonthModel();
			this.createYearViewModel();
			this.createCardTypeViewModel();

		},
		triggerGetOrderPaymentDetails: function (selectedDocument) {
			var oThis = this;
			var oModel = this.getModel();
			oModel.read("/PaymentHeaderSet('" + selectedDocument + "')", {
				urlParameters: {
					"$expand": "PaymentCashSet,PaymentEFTSet"
				},
				success: function (data) {
					oThis.onSuccessGetOrderPaymentDetails(data);
				},
				error: function (error) {
					oThis.onErrorGetOrderPaymentDetails(error);
				}
			});
		},
		onSuccessGetOrderPaymentDetails: function (data) {
			var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
			var oViewModel = this.getView().getModel("paymentViewModel");
			var action = oViewModel.getProperty("/action");
			var selectedDocument = oViewModel.getProperty("/vbeln");
			var payableAmount = 0;
			var changeAmount = 0;
			var paid;
			var dueAmount;
			var readTime = changeOrderHeaderModel.getProperty("/ReadTime");
			if (!readTime) {
				changeOrderHeaderModel.setProperty("/ReadTime", data.ReadTime);
			}
			this.triggerGetOrderDetails(selectedDocument);
			this.updateCashList(data);
			this.updateCardList(data);

			if (action && action === this.getResourceBundle().getText("actionChangeOrder")) {
				paid = data.AmountPaid;
				dueAmount = oViewModel.getProperty("/totalAmount");
				payableAmount = parseFloat(dueAmount, 10) - parseFloat(paid, 10);
				payableAmount = parseFloat(payableAmount, 10).toFixed(2).toString();
				oViewModel.setProperty("/payableAmount", payableAmount);
				oViewModel.setProperty("/paid", paid);
			} else if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
				oViewModel.setProperty("/totalAmount", data.SalesAmount);
				oViewModel.setProperty("/busy", false);
			} else if (action && action === this.getResourceBundle().getText("actionReceivePayment")) {
				oViewModel.setProperty("/totalAmount", data.SalesAmount);
				oViewModel.setProperty("/paid", data.AmountPaid);

				payableAmount = parseFloat(data.SalesAmount, 10) - parseFloat(data.AmountPaid, 10);
				payableAmount = parseFloat(payableAmount, 10).toFixed(2).toString();
				oViewModel.setProperty("/payableAmount", payableAmount);
				oViewModel.setProperty("/busy", false);
			}
			changeAmount = parseFloat(changeAmount, 10).toFixed(2).toString();
			oViewModel.setProperty("/changeAmount", changeAmount);
			this.updateCardAmountValue();
		},
		onErrorGetOrderPaymentDetails: function (error) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", false);
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});
		},
		triggerGetOrderDetails: function (selectedDocument) {
			var oThis = this;
			var oModel = this.getModel();
			oModel.read("/HeaderSet('" + selectedDocument + "')", {
				urlParameters: {
					"$expand": "HeaderPartnerSet"
				},
				success: function (data) {
					oThis.onSuccessGetOrderDetails(data);
				},
				error: function (error) {
					oThis.onErrorGetOrderDetails(error);
				}
			});
		},
		onSuccessGetOrderDetails: function (data) {
			this.updateOrderDetails(data);
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", false);

		},
		onErrorGetOrderDetails: function (error) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", false);
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});
		},
		updateOrderDetails: function (data) {
			var customerOrderViewModel = this.getView().getModel("customerOrderViewModel");

			//----to fetch and save country code (code by : C5265889)
			if (data.HeaderPartnerSet && data.HeaderPartnerSet.results) {
				var partnerSet = data.HeaderPartnerSet.results;
				for (var i = 0; i < partnerSet.length; i++) {
					if (partnerSet[i].PartnerFunctionCode === "SH") {
						customerOrderViewModel.setProperty("/countryCode", partnerSet[i].CountryCode);
					}
				}
			}

			customerOrderViewModel.setProperty("/SalesOrganization", data.SalesOrganization);
			customerOrderViewModel.setProperty("/DistributionChannel", data.DistributionChannel);
			customerOrderViewModel.setProperty("/Division", data.Division);
			customerOrderViewModel.setProperty("/DeliveryPlant", data.DeliveryPlant);
			customerOrderViewModel.setProperty("/SoldToPartyID", data.SoldToPartyID);
			customerOrderViewModel.setProperty("/SalesOrderTypeCode", data.SalesOrderTypeCode);
			customerOrderViewModel.setProperty("/Inco1", data.Inco1);
			customerOrderViewModel.setProperty("/DocumentCurrency", data.DocumentCurrency);
		},
		updateCashList: function (data) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var paidCashSet = [];
			var cashSet;
			var cashCount;
			var cash;
			if (data.PaymentCashSet) {
				cashSet = data.PaymentCashSet.results;
				if (cashSet) {
					cashCount = cashSet.length;
					for (var cashIndex = 0; cashIndex < cashCount; cashIndex++) {
						cash = cashSet[cashIndex];
						cash.isEditable = false;
						paidCashSet.push(cash);
					}
					paidCashSet.push({});
					oViewModel.setProperty("/CashSet", paidCashSet);
				}
			}

		},
		updateCardList: function (data) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var customerOrderViewModel = this.getView().getModel("customerOrderViewModel");
			var countryCode = customerOrderViewModel.getProperty("/countryCode");
			var cards = [];
			var cardCount;
			var cardSet;
			var card;
			var cardEntry;
			var cardNo;
			var cardExpiry;
			if (data.PaymentEFTSet) {
				cardSet = data.PaymentEFTSet.results;
				if (cardSet) {
					cardCount = cardSet.length;
					for (var cardIndex = 0; cardIndex < cardCount; cardIndex++) {
						card = cardSet[cardIndex];
						cardEntry = {};
						cardNo = card.Cardnum;
						if (cardNo) {
							cardEntry.cardPartOne = cardNo.substring(0, 4);
							cardEntry.cardPartTwo = cardNo.substring(4, 8);
							cardEntry.cardPartThree = cardNo.substring(8, 12);
							cardEntry.cardPartFour = cardNo.substring(12, 16);
						}
						cardEntry.cardType = card.Cardtype;
						cardEntry.cardAmount = card.Amount;
						cardExpiry = card.Expiry;
						if (cardExpiry) {
							cardEntry.month = cardExpiry.substring(0, 2);
							cardEntry.year = cardExpiry.substring(2, 4);
						}
						cardEntry.referenceNo = card.Txnkey;
						cardEntry.txnType = card.Txnsrc;
						cardEntry.isEditable = false;
						cardEntry.countryCode = countryCode;
						cardEntry.isCurrentPayment = false;
						cards.push(cardEntry);
					}
					//cards.push({});
					oViewModel.setProperty("/CardSet", cards);
					this.onAddCard();
				}
			}
		},
		updateHeaderPartnerSet: function (data) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var isBMPartnerRead = false;
			var isPEPartnerRead = false;
			var partner;
			var partnerSet;
			var partnerCount;
			if (data.HeaderPartnerSet && data.HeaderPartnerSet.results) {
				partnerSet = data.HeaderPartnerSet.results;
				partnerCount = partnerSet.length;
				for (var partnerIndex = 0; partnerIndex < partnerCount; partnerIndex++) {
					partner = partnerSet[partnerIndex];
					if (partner.PartnerFunctionCode === "YA") {
						oViewModel.setProperty("/bmPartner", partner);
						isBMPartnerRead = true;
					} else if (partner.PartnerFunctionCode === "PE") {
						oViewModel.setProperty("/pePartnerCustomerID", partner.CustomerID);
						isPEPartnerRead = true;
					}

					if (isBMPartnerRead && isPEPartnerRead) {
						break;
					}
				}
			}
		},

		createMonthModel: function () {
			var monthSet = [];
			var monthViewModel = new JSONModel({});
			var oMonth;
			var value;
			for (var monthIndex = 1; monthIndex <= 12; monthIndex++) {
				oMonth = {};

				if (monthIndex <= 9) {
					value = "0" + monthIndex;
					oMonth.Key = value;
				} else {
					value = monthIndex;
					oMonth.Key = value;
				}
				oMonth.Value = value;

				monthSet.push(oMonth);
			}

			monthViewModel.setProperty("/MonthSet", monthSet);
			this.getView().setModel(monthViewModel, "monthViewModel");
		},

		createYearViewModel: function () {
			var yearViewModel = new JSONModel({});
			var date = new Date();
			var fullYear = date.getFullYear();
			fullYear = fullYear.toString();
			var year = fullYear.substring(2, fullYear.length);
			var yearSet = [];
			var oYear;
			for (var yearIndex = 1; yearIndex <= 10; yearIndex++) {
				oYear = {};
				oYear.Key = year;
				oYear.Value = year;
				yearSet.push(oYear);
				year++;
			}

			yearViewModel.setProperty("/YearSet", yearSet);
			this.getView().setModel(yearViewModel, "yearViewModel");

		},
		createCardTypeViewModel: function () {
			var cardTypesViewModel = new JSONModel({
				"CardTypes": [{
					"Key": "",
					"Value": ""
				}, {
					"Key": "MASTERCARD",
					"Value": "MASTERCARD"
				}, {
					"Key": "VISA",
					"Value": "VISA"
				}]

			});
			this.getView().setModel(cardTypesViewModel, "cardTypesViewModel");
		},
		// -- changes WRT to BPoint integration  from : C5265889
		onBPointPayment: function (oEvent) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var action = oViewModel.getProperty("/action");
			var oCardBindingContext = oEvent.getSource().getParent().getBindingContext("paymentViewModel");
			var cardPath = oCardBindingContext.sPath;
			var isCardDetailsValid = false;
			var isPayAmountValid = false;
			var cardDetails = oViewModel.getProperty(cardPath);
			var referenceNo = cardDetails.referenceNo;
			if (!referenceNo) {
				isCardDetailsValid = this.validateCardAmount(cardPath);
				if (isCardDetailsValid) {
					if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
						isPayAmountValid = this.updateAmountValuesForReturnOrder();
					} else {
						isPayAmountValid = this.updateAmountValues();
					}
					if (isPayAmountValid) {
						oViewModel.setProperty("/busy", true);
						if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
							this.triggerCardPayment(cardDetails, cardPath, false);
						} else {
							this.onBPointAuthKeyFetch(cardPath);
						}

						oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", false);
						oViewModel.setProperty(cardPath + "/amountValueState", "None");
					} else {
						oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", true);
						oViewModel.setProperty(cardPath + "/amountValueState", "Error");
					}
				} else {
					oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", true);
					oViewModel.setProperty(cardPath + "/amountValueState", "Error");
				}
			}
		},
		onBPointAuthKeyFetch: function (cardPath) {
			//BusyIndicator.show();
			var _that = this;
			var oViewModel = this.getView().getModel("paymentViewModel");
			var customerOrderViewModel = this.getView().getModel("customerOrderViewModel");
			this.getView().getModel("customerOrderViewModel");
			var deliveryPlant = customerOrderViewModel.getProperty("/DeliveryPlant"); //Werks
			var sCustomerID = customerOrderViewModel.getProperty("/SoldToPartyID"); //Kunnr
			var salesOrg = customerOrderViewModel.getProperty("/SalesOrganization"); //Vkorg
			if (!deliveryPlant) {
				deliveryPlant = "";
			}
			var sCardAmount = oViewModel.getProperty(cardPath + "/cardAmount").replace(/,/g, "");
			var oModel = this.getOwnerComponent().getModel("authKey");
			oModel.callFunction(
				"/GetAuthKey", {
					method: "GET",
					urlParameters: {
						"Amount": sCardAmount,
						"Werks": deliveryPlant,
						"Vkorg": salesOrg,
						"Kunnr": sCustomerID
					},
					success: function (oRetrievedData, oResponse) {
						var oRes = oRetrievedData.GetAuthKey;
						var sMessage = oRes.Message;
						oViewModel.setProperty("/authKey", oRes.AuthKey);
						oViewModel.setProperty("/authKeyGuid", oRes.GuId);
						if (sMessage === "SUCCESS") {
							_that.triggerPaymentHeader(oRes.AuthKey, oRes.GuId, sCardAmount, cardPath, true);

						} else {
							MessageBox.warning("Auth key fetch is " + sMessage);
							oViewModel.setProperty("/busy", false);
						}

					}.bind(this),
					error: function (oError) {
						oViewModel.setProperty("/busy", false);
						MessageBox.error("Fail to create auth key");
					}.bind(this)
				});
		},
		triggerPaymentHeader: function (sAuthKey, sGuId, sCardAmount, cardPath, flagX) {
			var oThis = this;
			var oViewModel = this.getView().getModel("paymentViewModel");
			var customerOrderViewModel = this.getView().getModel("customerOrderViewModel");
			var currency = customerOrderViewModel.getProperty("/DocumentCurrency");
			var vbeln = oViewModel.getProperty("/vbeln");

			var cardAmount = oViewModel.getProperty(cardPath + "/cardAmount");
			var cardNo = sGuId;

			cardAmount = cardAmount.replace(/,/g, "");

			var paymentRequest = {};
			paymentRequest = this.createPaymentHeaderRequest();

			var paymentEFT = {};
			var paymentEFTSet = [];

			paymentEFT.Waerk = currency;
			paymentEFT.Amount = cardAmount;
			paymentEFT.Cardnum = cardNo;

			if (vbeln) {
				paymentEFT.Vbeln = vbeln;
			}
			if (flagX) {
				paymentEFT.Cardtype = "X"; // auth auth key fetch success of BPoint
			} else {
				paymentEFT.Cardtype = "2"; // after Bpoint payment successfull
			}

			paymentEFTSet.push(paymentEFT);
			paymentRequest.PaymentEFTSet = paymentEFTSet;

			var oModel = this.getModel();
			oModel.setUseBatch(false);
			oModel.create("/PaymentHeaderSet", paymentRequest, {
				success: function (data) {
					oThis.onBPointCardPaymentSuccessCallback(data, sAuthKey, sGuId, sCardAmount, cardPath, flagX);
				},
				error: function (error) {
					oThis.onCardPaymentErrorCallback(error);
				}
			});
		},
		onBPointCardPaymentSuccessCallback: function (data, sAuthKey, sGuId, sCardAmount, cardPath, flagX) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/vbeln", data.Vbeln);

			if (flagX) {
				this.bPointPaymentProcess(sAuthKey, sGuId, sCardAmount, cardPath);
			} else {
				this.updateBPointCardAmount(sCardAmount, cardPath);
				//oViewModel.setProperty("/busy", false);
			}
		},
		bPointPaymentProcess: function (sAuthKey, sGuId, sCardAmount, cardPath) {
			var _that = this;
			var sBpointURL;
			var oViewModel = this.getView().getModel("paymentViewModel");
			var oBPointURIData = this.getOwnerComponent().getModel("bpointModel").getData();
			var hostName = window.location.hostname;
			if (hostName.indexOf("cc7c2b28c") !== -1 || hostName.indexOf("c4956f941") !== -1) {
				sBpointURL = oBPointURIData.protocol + oBPointURIData.host + oBPointURIData.path + sAuthKey;
			}else{
				sBpointURL = oBPointURIData.protocol + oBPointURIData.liveHost + oBPointURIData.path + sAuthKey;
			}
			var htmlPage = new Html({
				preferDOM: true,
				content: "<iframe id='frameAdd' style='height:15rem;width:20rem' src='" + sBpointURL + "'></iframe>"

			});
			var oBPointDialog = new Dialog({
				type: DialogType.Message,
				title: "Bpoint payment",
				content: htmlPage,
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: "Submit",
					press: function () {
						_that._onBpointSubmit(sCardAmount, cardPath);
						oBPointDialog.destroy();
					}.bind(this)
				}),
				endButton: new Button({
					text: "Cancel",
					press: function () {
						oViewModel.setProperty("/busy", false);
						oBPointDialog.destroy();
					}.bind(this)
				})
			}).open();
		},
		_onBpointSubmit: function (sCardAmount, cardPath) {
			//BusyIndicator.show();
			var _that = this;
			var oModel = this.getOwnerComponent().getModel("authKey");
			var oViewModel = this.getView().getModel("paymentViewModel");
			var sAuthKey = oViewModel.getProperty("/authKey");
			var sGuId = oViewModel.getProperty("/authKeyGuid");
			var sVbeln = oViewModel.getProperty("/vbeln");
			oModel.callFunction(
				"/ActionSubmit", {
					method: "POST",
					urlParameters: {
						"GuId": sGuId,
						"AuthKey": sAuthKey,
						"Amount": sCardAmount,
						"Vbeln": sVbeln
					},
					success: function (oRetrievedData, oResponse) {
						//BusyIndicator.hide();
						var oRes = oRetrievedData.ActionSubmit;
						var sTransStatus = oRes.Response;
						if (sTransStatus === "Approved") {
							oRes.Amount = parseFloat(parseInt(oRes.Amount, 10) / 100, 10).toFixed(2);
							MessageToast.show(
								_that.getResourceBundle().getText("paymentSuccess"), {
									duration: 6000
								});
							//_that.updateBPointCardAmount(oRes, cardPath);
							oViewModel.setProperty("/bPointTxnNo", oRes.TransNo);
							_that.triggerPaymentHeader(sAuthKey, sGuId, oRes.Amount, cardPath, false);
						} else {
							oViewModel.setProperty("/busy", false);
							if (oRes.Response === "") {
								MessageBox.error("Please try again");
							} else {
								MessageBox.error("Bpoint transaction is" + oRes.Response + "\n" + oRes.ResMsg);
							}

						}

					}.bind(this),
					error: function (oError) {
						//	BusyIndicator.hide();
						this._showServiceError(oError);
					}.bind(this)
				});
		},
		updateBPointCardAmount: function (sCardAmount, cardPath) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var cardEntry = {};
			cardEntry.cardAmount = sCardAmount;
			cardEntry.referenceNo = oViewModel.getProperty("/bPointTxnNo");
			cardEntry.isEditable = false;
			cardEntry.isCurrentPayment = true;
			cardEntry.txnType = "B";
			oViewModel.setProperty(cardPath, cardEntry);
			this.onAddCard();
			this.updateAmountValues();
			this.updateCardAmountValue();
			var payableAmount = oViewModel.getProperty("/payableAmount");
			if (payableAmount <= 0) {
				this.handlePayment();
			} else {
				oViewModel.setProperty("/busy", false);
				sap.m.MessageToast.show(
					this.getResourceBundle().getText("paymentSuccess"), {
						duration: 6000
					});
				oViewModel.setProperty("/displayBackButton", false);
			}
		},
		//-------------------------BPoint integration -----------------
		onCardPayment: function (oEvent) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var action = oViewModel.getProperty("/action");
			var oCardBindingContext = oEvent.getSource().getParent().getBindingContext("paymentViewModel");
			var cardPath = oCardBindingContext.sPath;
			var isCardDetailsValid = false;
			var isPayAmountValid = false;
			var cardDetails = oViewModel.getProperty(cardPath);
			var referenceNo = cardDetails.referenceNo;
			if (!referenceNo) {
				isCardDetailsValid = this.validateCardAmount(cardPath);
				if (isCardDetailsValid) {
					if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
						isPayAmountValid = this.updateAmountValuesForReturnOrder();
					} else {
						isPayAmountValid = this.updateAmountValues();
					}
					if (isPayAmountValid) {
						oViewModel.setProperty("/busy", true);
						this.triggerCardPayment(cardDetails, cardPath, true);
						oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", false);
						oViewModel.setProperty(cardPath + "/amountValueState", "None");
					} else {
						oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", true);
						oViewModel.setProperty(cardPath + "/amountValueState", "Error");
					}
				} else {
					oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", true);
					oViewModel.setProperty(cardPath + "/amountValueState", "Error");
				}
			}
		},
		onAddCard: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var customerOrderViewModel = this.getView().getModel("customerOrderViewModel");
			var countryCode = customerOrderViewModel.getProperty("/countryCode");
			oViewModel.setProperty("/busy", true);
			var cardItems = oViewModel.getProperty("/CardSet");
			var cardsCount = cardItems.length;
			var card = {};
			card.cardAmount = oViewModel.getProperty("/payableAmount");
			card.isEditable = true;
			card.txnType = "BP";
			if (countryCode) {
				card.countryCode = countryCode;
			} else {
				card.countryCode = "AU";
			}
			oViewModel.setProperty("/CardSet/" + cardsCount, card);
			oViewModel.setProperty("/busy", false);
		},
		onCashAmountChange: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var action = oViewModel.getProperty("/action");
			if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
				this.updateAmountValuesForReturnOrder(true);
			} else {
				this.updateAmountValues(true);
			}
			this.updateCardAmountValue();
		},
		updateAmountValuesForReturnOrder: function (isCash) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var returnedOrderAmount = oViewModel.getProperty("/paid");
			var cashSet = oViewModel.getProperty("/CashSet");
			var cashCount = cashSet.length;
			var cardSet = oViewModel.getProperty("/CardSet");
			var cardCount = cardSet.length;
			var returnOrderAmount = oViewModel.getProperty("/paid");
			var cashAmount = 0;
			var cardAmount = 0;
			var paidValue = 0;
			var payableAmount = 0;
			var changeAmount = 0;
			var cash;
			var card;
			for (var cashIndex = 0; cashIndex < cashCount; cashIndex++) {
				cash = cashSet[cashIndex];
				if (cash.Cash && cash.isEditable !== false) {
					cash.Cash = cash.Cash.replace(/,/g, "");
					cashAmount += parseFloat(cash.Cash);
				}
			}
			for (var cardIndex = 0; cardIndex < cardCount; cardIndex++) {
				card = cardSet[cardIndex];
				if (card.cardAmount && card.isCurrentPayment) {
					card.cardAmount = card.cardAmount.replace(/,/g, "");
					cardAmount += parseFloat(card.cardAmount);
				}
			}
			paidValue = parseFloat(cashAmount) + parseFloat(cardAmount);
			payableAmount = parseFloat(returnedOrderAmount) - parseFloat(paidValue);
			returnOrderAmount = parseFloat(returnOrderAmount);
			if (paidValue > returnOrderAmount && !isCash) {
				sap.m.MessageToast.show(
					this.getResourceBundle().getText("paidValueValidation"), {
						duration: 6000
					});
				return false;
			} else {
				if (payableAmount < 0) {
					changeAmount = (payableAmount) * -1;
					payableAmount = 0;
				}
				payableAmount = parseFloat(payableAmount).toFixed(2);
				changeAmount = parseFloat(changeAmount).toFixed(2);

				oViewModel.setProperty("/payableAmount", payableAmount);
				oViewModel.setProperty("/changeAmount", changeAmount);
				return true;
			}
		},

		updateAmountValues: function (isCash) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var totalAmount = oViewModel.getProperty("/totalAmount");
			var cashSet = oViewModel.getProperty("/CashSet");
			var cashCount = cashSet.length;
			var cardSet = oViewModel.getProperty("/CardSet");
			var cardCount = cardSet.length;
			var cashAmount = 0;
			var cardAmount = 0;
			var paidValue = 0;
			var payableAmount = 0;
			var changeAmount = 0;
			var cash;
			var card;
			for (var cashIndex = 0; cashIndex < cashCount; cashIndex++) {
				cash = cashSet[cashIndex];
				if (cash.Cash) {
					cash.Cash = cash.Cash.replace(/,/g, "");
					cashAmount += parseFloat(cash.Cash);
				}
			}
			for (var cardIndex = 0; cardIndex < cardCount; cardIndex++) {
				card = cardSet[cardIndex];
				if (card.cardAmount && !card.isEditable) {
					card.cardAmount = card.cardAmount.replace(/,/g, "");
					cardAmount += parseFloat(card.cardAmount);
				}
			}
			paidValue = parseFloat(cashAmount) + parseFloat(cardAmount);
			payableAmount = parseFloat(totalAmount) - parseFloat(paidValue);

			if (payableAmount < 0 && !isCash) {
				sap.m.MessageToast.show(
					this.getResourceBundle().getText("dueAmountValueValidation"), {
						duration: 6000
					});
				return false;
			} else {
				if (payableAmount < 0) {
					changeAmount = (payableAmount) * -1;
					payableAmount = 0;
				}
				payableAmount = parseFloat(payableAmount).toFixed(2);
				changeAmount = parseFloat(changeAmount).toFixed(2);
				paidValue = parseFloat(paidValue).toFixed(2);
				oViewModel.setProperty("/paid", paidValue);
				oViewModel.setProperty("/payableAmount", payableAmount);
				oViewModel.setProperty("/changeAmount", changeAmount);
				return true;
			}
		},
		updateCardAmountValue: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var cardItems = oViewModel.getProperty("/CardSet");
			var cardsCount = cardItems.length;
			var card;
			var cardPath;
			if (cardsCount >= 0) {
				cardPath = cardsCount - 1;
				card = oViewModel.getProperty("/CardSet/" + cardPath);
				card.cardAmount = oViewModel.getProperty("/payableAmount");
			}
			oViewModel.refresh();
		},
		onCardAmountChange: function (oEvent) {
			var oCardBindingContext = oEvent.getSource().getParent().getBindingContext("paymentViewModel");
			var cardPath = oCardBindingContext.sPath;
			this.validateCardAmount(cardPath);

		},
		validateCardAmount: function (cardPath) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var payableAmount = oViewModel.getProperty("/payableAmount");
			var cardDetails = oViewModel.getProperty(cardPath);
			var cardAmountValue = parseFloat(cardDetails.cardAmount);
			var payableAmountValue = parseFloat(payableAmount);

			if (cardAmountValue && cardAmountValue <= payableAmountValue) {
				oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", false);
				oViewModel.setProperty(cardPath + "/amountValueState", "None");
				return true;
			} else {
				oViewModel.setProperty(cardPath + "/showAmountValueStateMessage", true);
				oViewModel.setProperty(cardPath + "/amountValueState", "Error");
				return false;
			}
		},

		validateComboBox: function (oEvent) {
			var path = oEvent.getSource().getBindingPath("selectedKey");
			var showValueStatePath = oEvent.getSource().getBindingPath("showValueStateMessage");
			var valueStatePath = oEvent.getSource().getBindingPath("valueState");
			var oViewModel = this.getView().getModel("paymentViewModel");
			if (oViewModel.getProperty(path)) {
				oViewModel.setProperty(showValueStatePath, false);
				oViewModel.setProperty(valueStatePath, "None");
				return true;
			} else {
				oViewModel.setProperty(showValueStatePath, true);
				oViewModel.setProperty(valueStatePath, "Error");
				return false;
			}
		},

		triggerCardPayment: function (cardDetails, cardPath, bPinpad) {
			var oThis = this;
			var oModel = this.getModel();
			var oViewModel = this.getView().getModel("paymentViewModel");
			var currency = "AUD";
			var cardAmount = oViewModel.getProperty(cardPath + "/cardAmount");
			var cardPartOne = oViewModel.getProperty(cardPath + "/cardPartOne");
			var cardPartTwo = oViewModel.getProperty(cardPath + "/cardPartTwo");
			var cardPartThree = oViewModel.getProperty(cardPath + "/cardPartThree");
			var cardPartFour = oViewModel.getProperty(cardPath + "/cardPartFour");
			var cardType = oViewModel.getProperty(cardPath + "/cardType");
			var expiryMonth = oViewModel.getProperty(cardPath + "/month");
			var expiryYear = oViewModel.getProperty(cardPath + "/year");
			var vbeln = oViewModel.getProperty("/vbeln"); //Added by C5253525 #266670 ePOS payment split error
			var paymentRequest = {};
			var paymentEFT = {};
			var paymentEFTSet = [];
			var cardNo;

			cardAmount = cardAmount.replace(/,/g, "");

			if (cardPartOne && cardPartTwo && cardPartThree && cardPartFour) {
				cardNo = cardPartOne + cardPartTwo + cardPartThree + cardPartFour;
			}

			paymentRequest = this.createPaymentHeaderRequest();
			paymentEFT.Waerk = currency;
			paymentEFT.Amount = cardAmount;
			if (expiryMonth && expiryYear && cardNo) {
				paymentEFT.Expiry = expiryMonth + expiryYear;
				paymentEFT.Cardnum = cardNo;
			}

			if (vbeln) {
				paymentEFT.Vbeln = vbeln;
			}
			if (cardType) {
				paymentEFT.Cardtype = cardType;
			}
			if (!bPinpad) {
				paymentEFT.Cardtype = "2";
			}
			paymentEFTSet.push(paymentEFT);
			paymentRequest.PaymentEFTSet = paymentEFTSet;

			oModel.setUseBatch(false);
			oModel.create("/PaymentHeaderSet", paymentRequest, {
				success: function (data) {
					if(!bPinpad && data.PaymentEFTSet.results[0].Txnsrc === ""){
						data.PaymentEFTSet.results[0].Txnsrc = "B";
					}
					oThis.onCardPaymentSuccessCallback(data, cardPath);

				},
				error: function (error) {
					oThis.onCardPaymentErrorCallback(error);
				}
			});
		},
		onCardPaymentSuccessCallback: function (data, cardPath) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var action;
			var payableAmount;
			oViewModel.setProperty("/paymentVbeln", data.Vbeln);
			if (data.IsFailed) {
				sap.m.MessageToast.show(
					data.Message, {
						duration: 6000
					});
				oViewModel.setProperty("/busy", false);
			} else {
				oViewModel.setProperty(cardPath + "/isEditable", false);

				this.updateCardDetails(data, cardPath);
				action = oViewModel.getProperty("/action");
				if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
					this.updateAmountValuesForReturnOrder(true);
				} else {
					this.updateAmountValues(true);
				}
				this.onAddCard();
				payableAmount = oViewModel.getProperty("/payableAmount");
				//*//Start of addition by I327900 #384813/2017
				if (payableAmount <= 0) {
					this.handlePayment();
				} else {
					//*//End of addition by I327900 #384813/2017
					oViewModel.setProperty("/busy", false);
					oViewModel.setProperty("/displayBackButton", false);
					sap.m.MessageToast.show(
						this.getResourceBundle().getText("paymentSuccess"), {
							duration: 6000
						});
				} ////*//Added by I327900 #384813/2017
			}
		},
		onCardPaymentErrorCallback: function (error) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", false);
			var oModel = this.getModel();
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			oModel.setUseBatch(true);
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});
		},

		updateCardDetails: function (data, cardPath) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var cardSet;
			var cardEntry;
			var card;
			var cardNo;
			var cardExpiry;
			if (data.PaymentEFTSet) {
				cardSet = data.PaymentEFTSet.results;
				if (cardSet) {
					cardEntry = {};
					card = cardSet[0];
					cardNo = card.Cardnum;
					if (cardNo) {
						cardEntry.cardPartOne = cardNo.substring(0, 4);
						cardEntry.cardPartTwo = cardNo.substring(4, 8);
						cardEntry.cardPartThree = cardNo.substring(8, 12);
						cardEntry.cardPartFour = cardNo.substring(12, 16);
					}
					cardEntry.cardType = card.Cardtype;
					cardEntry.cardAmount = card.Amount;
					cardEntry.txnType = card.Txnsrc;
					cardExpiry = card.Expiry;
					if (cardExpiry) {
						cardEntry.month = cardExpiry.substring(0, 2);
						cardEntry.year = cardExpiry.substring(2, 4);
					}
					cardEntry.referenceNo = card.Txnkey;
					cardEntry.isEditable = false;
					cardEntry.isCurrentPayment = true;
					oViewModel.setProperty(cardPath, cardEntry);
				}
			}
		},
		getAssestID: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var assestID = sap.ui.getCore().byId("currentAsset");
			var assestIDValue = "";
			var oAssetModel = sap.ui.getCore().getModel("AssetModel");
			if (assestID) {
				assestIDValue = assestID.getValue();
			} else if (oAssetModel) {
				assestIDValue = oAssetModel.getProperty("/DefaultAsset");
			}
			oViewModel.setProperty("/assestID", assestIDValue);
		},
		createPaymentHeaderRequest: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
			var action = oViewModel.getProperty("/action");
			var customerOrderViewModel = this.getView().getModel("customerOrderViewModel");
			var salesOrg = customerOrderViewModel.getProperty("/SalesOrganization");
			var distrubutionChannel = customerOrderViewModel.getProperty("/DistributionChannel");
			var division = customerOrderViewModel.getProperty("/Division");
			var deliveryPlant = customerOrderViewModel.getProperty("/DeliveryPlant");
			var currency = customerOrderViewModel.getProperty("/DocumentCurrency");
			var incoTerms1 = customerOrderViewModel.getProperty("/Inco1");
			var salesOrderType = customerOrderViewModel.getProperty("/SalesOrderTypeCode");
			var assestID = oViewModel.getProperty("/assestID");
			var totalAmount = oViewModel.getProperty("/totalAmount");
			var returnOrderedAmount = oViewModel.getProperty("/paid");
			/*Start of commenting by C5253525 #266670 ePOS payment split error*/
			//start of changes by i327900 #21056 
			//  var vbeln; 
			//  var paymentVbeln = oViewModel.getProperty("/paymentVbeln");
			// if(paymentVbeln){
			//  vbeln = oViewModel.getProperty("/paymentVbeln");		
			// }
			// else{
			// vbeln = oViewModel.getProperty("/vbeln");
			// }
			var vbeln = oViewModel.getProperty("/paymentVbeln"); //Added by i327900 #392470/2017
			//	var vbeln = oViewModel.getProperty("/vbeln"); //added by i327900 #392470/2017
			//End of changes by i327900 #21056
			/*End of commenting by C5253525 #266670 ePOS payment split error*/
			var customerID = customerOrderViewModel.getProperty("/SoldToPartyID");
			var returnOrderType = "YIR";

			var paymentRequest = {};
			paymentRequest.Sydatum = null;
			paymentRequest.Vkorg = salesOrg;
			paymentRequest.Inco1 = incoTerms1;
			paymentRequest.Werks = deliveryPlant;
			paymentRequest.Waerk = currency;
			paymentRequest.Spart = division;
			paymentRequest.Kunnr = customerID;
			paymentRequest.Vtweg = distrubutionChannel;
			paymentRequest.ReadTime = changeOrderHeaderModel.getProperty("/ReadTime");

			if (vbeln) {
				paymentRequest.Vbeln = vbeln;
			}
			if (assestID) {
				paymentRequest.Assetid = assestID;
			}

			if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
				paymentRequest.Auart = returnOrderType;
				paymentRequest.Posamt = returnOrderedAmount;
			} else {
				paymentRequest.Auart = salesOrderType;
				paymentRequest.Posamt = totalAmount;
			}

			return paymentRequest;
		},
		handlePayment: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var isEligibleForReturnOrder = this.isEligibleForReturnOrder();
			if (isEligibleForReturnOrder) {
				oViewModel.setProperty("/busy", true);
				var isCashAvailable = this.isCashAvailable();
				if (isCashAvailable) {
					this.triggerPayment();
				} else {
					this.triggerServiceCalls();
				}
			} else {
				sap.m.MessageToast.show(
					this.getResourceBundle().getText("fullPaymentMsg"), {
						duration: 6000
					});
			}
		},
		isCashAvailable: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var cashSet = oViewModel.getProperty("/CashSet");
			var cash;
			var cashAmount;
			var cashSeq;
			var cashCount = cashSet.length;
			for (var cashIndex = 0; cashIndex < cashCount; cashIndex++) {
				cash = cashSet[cashIndex];
				cashAmount = cash.Cash;
				cashSeq = cash.Seq;
				if (cashAmount && !cashSeq) {
					return true;
				}
			}
			return false;
		},
		triggerPayment: function () {
			var oThis = this;
			var oViewModel = this.getView().getModel("paymentViewModel");
			var paymentRequest = this.createPaymentHeaderRequest();
			var cashSet = oViewModel.getProperty("/CashSet");
			var cashCount = cashSet.length;
			var paymentCashSet = [];
			var paymentEFTSet = [];
			var paymentCash;
			var cash;
			var cashAmount;
			var cashSeq;
			var vbeln = oViewModel.getProperty("/paymentVbeln");

			paymentRequest.PaymentEFTSet = paymentEFTSet;
			for (var cashIndex = 0; cashIndex < cashCount; cashIndex++) {
				cash = cashSet[cashIndex];
				cashAmount = cash.Cash;
				cashSeq = cash.Seq;
				cashAmount = cashAmount.replace(/,/g, "");
				if (cashAmount && !cashSeq) {
					paymentCash = {};
					paymentCash.Cash = cashAmount;
					paymentCash.Vbeln = vbeln;
					paymentCashSet.push(paymentCash);
				}
			}
			paymentRequest.PaymentCashSet = paymentCashSet;

			var oModel = this.getModel();
			oModel.setUseBatch(false);
			oModel.create("/PaymentHeaderSet", paymentRequest, {
				success: function (data) {
					oThis.onPaymentSuccessCallback(data);

				},
				error: function (error) {
					oThis.onPaymentErrorCallback(error);
				}
			});
		},
		onPaymentSuccessCallback: function (data) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/paymentVbeln", data.Vbeln);
			if (data.IsFailed) {
				sap.m.MessageToast.show(
					data.Message, {
						duration: 6000
					});
				oViewModel.setProperty("/busy", false);
			} else {
				this.triggerServiceCalls();
			}
		},
		onPaymentErrorCallback: function (error) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", false);
			var oModel = this.getModel();
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			oModel.setUseBatch(true);
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});
		},
		triggerServiceCalls: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			//var salesOrderID = oViewModel.getProperty("/paymentVbeln");
			//var isPrintReceiptSelected = oViewModel.getProperty("/PrintReceipt");
			//var isEmailSelected = oViewModel.getProperty("/EmailReceipt");
			var payableAmount = oViewModel.getProperty("/payableAmount");
			//var oModel = null;
			if (this.action === this.getResourceBundle().getText("actionReceivePayment")) {
				payableAmount = parseFloat(payableAmount);
				if (payableAmount <= 0) {
					this.triggerOrderHeaderUpdate();
				} else {
					this.triggerPrintService();
				}

				/*if (isPrintReceiptSelected || isEmailSelected) {
				               this.triggerReceipt(salesOrderID, null);
				} else {
				               oModel = this.getModel();
				               oModel.setUseBatch(true);
				               oViewModel.setProperty("/busy", false);
				               this.navToHomeScreen(null, salesOrderID);
				}*/
			} else if (this.action === this.getResourceBundle().getText("actionChangeOrder")) {
				this.triggerUpdateOrder();
			} else if (this.action === this.getResourceBundle().getText("actionOrderReturn")) {
				this.triggerReturnOrder();
			} else {
				this.triggerUpdateOrder();
			}
		},
		triggerPrintService: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var salesOrderID = oViewModel.getProperty("/paymentVbeln");
			var isPrintReceiptSelected = oViewModel.getProperty("/PrintReceipt");
			var isEmailSelected = oViewModel.getProperty("/EmailReceipt");
			var oModel = null;

			if (isPrintReceiptSelected || isEmailSelected) {
				jQuery.sap.delayedCall(5000, this, function () {
					this.triggerReceipt(salesOrderID, null);
				});
			} else {
				oModel = this.getModel();
				oModel.setUseBatch(true);
				oViewModel.setProperty("/busy", false);
				this.navToHomeScreen(null, salesOrderID);
			}
		},
		triggerOrderHeaderUpdate: function () {
			var oThis = this;
			var oModel = this.getModel();
			var customerOrderViewModel = this.getView().getModel("customerOrderViewModel");
			var oViewModel = this.getView().getModel("paymentViewModel");
			var salesOrg = customerOrderViewModel.getProperty("/SalesOrganization");
			var distrubutionChannel = customerOrderViewModel.getProperty("/DistributionChannel");
			var division = customerOrderViewModel.getProperty("/Division");
			var deliveryPlant = customerOrderViewModel.getProperty("/DeliveryPlant");
			var currency = customerOrderViewModel.getProperty("/DocumentCurrency");
			var incoTerms1 = customerOrderViewModel.getProperty("/Inco1");
			var salesOrderType = customerOrderViewModel.getProperty("/SalesOrderTypeCode");
			var vbeln = oViewModel.getProperty("/paymentVbeln");
			var customerID = customerOrderViewModel.getProperty("/SoldToPartyID");
			var updateOrderHeaderRequest = {};
			updateOrderHeaderRequest.SalesOrderID = vbeln;
			updateOrderHeaderRequest.SalesOrganization = salesOrg;
			updateOrderHeaderRequest.DistributionChannel = distrubutionChannel;
			updateOrderHeaderRequest.Division = division;
			updateOrderHeaderRequest.DeliveryPlant = deliveryPlant;
			updateOrderHeaderRequest.DocumentCurrency = currency;
			updateOrderHeaderRequest.Inco1 = incoTerms1;
			updateOrderHeaderRequest.SoldToPartyID = customerID;
			updateOrderHeaderRequest.SalesOrderTypeCode = salesOrderType;
			updateOrderHeaderRequest.Zzpaidfull = "X";
			updateOrderHeaderRequest.Updkz = "U";
			updateOrderHeaderRequest.IsCheckout = "X";
			updateOrderHeaderRequest.ItemSet = [];
			oModel.setUseBatch(false);
			oModel.create("/HeaderSet", updateOrderHeaderRequest, {
				success: function () {
					oThis.triggerPrintService();
				},
				error: function () {}
			});
		},
		/*addItemSetInRequest: function (isDelete) {
		               var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
		               var changeOrderDeleteItemsModel = this.getOwnerComponent().getModel("changeOrderDeleteItemsModel");
		               var orderItems = null;
		               var ItemSet = [];
		               var salesOrderID = changeOrderHeaderModel.getProperty("/salesOrderID");
		               var deliveryPlant = changeOrderHeaderModel.getProperty("/deliveryPlantCode");
		               if (isDelete) {
		                              orderItems = changeOrderDeleteItemsModel.getProperty("/ItemSet");
		               } else {
		                              orderItems = changeOrderHeaderModel.getProperty("/ItemSet");
		               }
		               
		               if (!orderItems) {
		                              return ItemSet;
		               }
		               
		               var itemCount = orderItems.length;
		               
		               
		               for (var itemIndex = 0; itemIndex < itemCount; itemIndex++) {
		                              var orderItem = null;
		                              if (isDelete) {
		                                             orderItem= changeOrderDeleteItemsModel.getProperty("/ItemSet/"+ itemIndex);
		                              } else {
		                                             orderItem= changeOrderHeaderModel.getProperty("/ItemSet/"+ itemIndex);              
		                              }
		                              if (orderItem.isAddedItem) {
		                                             continue;
		                              }
		                              var materialNo = orderItem.materialNo;
		                              var stockUnit = orderItem.stockUnit;
		                              var itemDiscount =  orderItem.discount;
		                              var itemDiscountType = orderItem.discountType;
		                              var counter = orderItem.counter;
		                              if (materialNo) {
		                                             var item = {};
		                                             var quantity = orderItem.quantity;
		                                             if (!quantity) {
		                                                            quantity = "1";
		                                             }
		                                             item.ItemID = orderItem.itemID;
		                                             item.SalesOrderID = salesOrderID;
		                                             item.MaterialID =  materialNo;                    
		                                             item.SalesUnit = stockUnit;
		                                             item.Plant = deliveryPlant;
		                                             item.OrderQty= quantity;
		                                             item.RequestedDeliveryDate = this.formatter.formatDate(orderItem.deliveryDate);
		                                             if (isDelete) {
		                                                            item.Updkz = "D";
		                                             } else {
		                                                            item.Updkz = "U";
		                                             }
		                                             var ItemPriceCondSet = [];
		                                             var itemCondition = {};
		                                             
		                                             if (itemDiscountType) {
		                                                            if (!itemDiscount) {
		                                                                           itemDiscount = "0";
		                                                            }
		                                                            if (itemDiscountType === "AUD") {
		                                                                           itemCondition.CondTypeCode = "ZMA5";
		                                                                           itemCondition.UnitOfMeasure = orderItem.salesUnit;
		                                                            } else {
		                                                                           itemCondition.CondTypeCode = "ZMA4";               
		                                                            }
		                                                            
		                                                            itemCondition.AmountInternal = itemDiscount; 
		                                                            itemCondition.Counter = counter; 
		                                                            ItemPriceCondSet.push(itemCondition);
		                                             }
		                                             item.ItemStatus = orderItem.ItemStatus;
		                                             item.PriceCondSet = ItemPriceCondSet;
		                                             ItemSet.push(item);
		                              }
		                              
		               }
		               return ItemSet;
		},*/
		triggerUpdateOrder: function () {
			var updateOrderRequest = {};
			var oThis = this;
			var oModel = this.getModel();
			var oViewModel = this.getView().getModel("paymentViewModel");
			var changeOrderHeaderModel = this.getOwnerComponent().getModel("changeOrderHeaderModel");
			var salesOrderID = changeOrderHeaderModel.getProperty("/salesOrderID");
			var orderTypeCode = changeOrderHeaderModel.getProperty("/orderTypeCode");
			var headerStatus = changeOrderHeaderModel.getProperty("/HeaderStatus");
			var customerPO = changeOrderHeaderModel.getProperty("/customerPO");
			var payableAmount = oViewModel.getProperty("/payableAmount");
			var updatedItemSet = null;
			var deletedItemSet = null;
			var ItemSet = null;
			updateOrderRequest.SalesOrderID = salesOrderID;
			updateOrderRequest.SalesOrderTypeCode = orderTypeCode;
			updateOrderRequest.PurchaseOrderNumber = customerPO;
			updateOrderRequest.Updkz = "U";

			payableAmount = parseFloat(payableAmount);
			if (headerStatus) {
				updateOrderRequest.HeaderStatus = headerStatus;
			}

			if (payableAmount <= 0) {
				updateOrderRequest.Zzpaidfull = "X";
			}

			updatedItemSet = OrderServiceUtil.getItemSetForUpdateOrderReq.apply(this);
			deletedItemSet = OrderServiceUtil.getItemSetForUpdateOrderReq.apply(this, [true]);

			ItemSet = updatedItemSet.concat(deletedItemSet);
			updateOrderRequest.ItemSet = ItemSet;
			oModel.setUseBatch(false);
			oModel.create("/HeaderSet", updateOrderRequest, {
				success: function (data) {
					oThis.onUpdateOrderSuccessCallback(data);
				},
				error: function (error) {
					oThis.onUpdateOrderErrorCallback(error);
				}
			});

		},
		onUpdateOrderSuccessCallback: function (data) {
			var oModel = this.getModel();
			var oViewModel = this.getView().getModel("paymentViewModel");
			var isPrintReceiptSelected = oViewModel.getProperty("/PrintReceipt");
			var isEmailSelected = oViewModel.getProperty("/EmailReceipt");
			var salesOrderID = data.SalesOrderID;
			var salesOrderTypeCode = data.SalesOrderTypeCode;
			var orderMsg;
			var errorMsg = data.ErrorMessage;
			if (salesOrderTypeCode === "YQT") {
				orderMsg = this.getResourceBundle().getText("quoteUpdated", [salesOrderID, errorMsg]);
			} else if (salesOrderTypeCode === "YIO") {
				orderMsg = this.getResourceBundle().getText("immediateOrderUpdated", [salesOrderID, errorMsg]);
			} else if (salesOrderTypeCode === "YOR") {
				orderMsg = this.getResourceBundle().getText("standardOrderUpdated", [salesOrderID, errorMsg]);
			} else if (salesOrderTypeCode === "YOR1") {
				orderMsg = this.getResourceBundle().getText("thirdPartyOrderUpdated", [salesOrderID, errorMsg]);
			} else {
				orderMsg = this.getResourceBundle().getText("salesOrderUpdated", [salesOrderID, errorMsg]);
			}

			if (isPrintReceiptSelected || isEmailSelected) {
				jQuery.sap.delayedCall(5000, this, function () {
					this.triggerReceipt(salesOrderID, orderMsg);
				});
			} else {
				this.navToHomeScreen(orderMsg);
				oViewModel.setProperty("/busy", false);
			}

			oModel.setUseBatch(true);
		},
		onUpdateOrderErrorCallback: function (error) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", false);
			var oModel = this.getModel();
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});

			oModel.setUseBatch(true);
		},
		navToHomeScreen: function (orderMsg, selectedDocument) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var oInitialViewModel = this.createViewModel();
			var action = oViewModel.getProperty("/action");
			selectedDocument = oViewModel.getProperty("/vbeln");

			if (this.action === this.getResourceBundle().getText("actionReceivePayment")) {
				var receivePaymentMsg = this.getResourceBundle().getText("receivePaymentMsg", [selectedDocument]);
				sap.m.MessageToast.show(
					receivePaymentMsg, {
						duration: 6000
					});

				this.getRouter().navTo("detail", {
					custContextPath: this.sCustContextPath
				}, true);
			}
			if (action && action === this.getResourceBundle().getText("actionChangeOrder")) {
				sap.m.MessageToast.show(
					orderMsg, {
						duration: 6000
					});
				this.getRouter().navTo("detail", {
					custContextPath: this.sCustContextPath
				}, true);
			} else if (action && action === this.getResourceBundle().getText("actionOrderReturn")) {
				sap.m.MessageToast.show(
					orderMsg, {
						duration: 6000
					});
				jQuery.sap.delayedCall(100, this, function () {
					this.getRouter().navTo("documentFlow", {
						documentID: selectedDocument,
						custContextPath: this.sCustContextPath
					}, true);
				});
			} else {
				this.getRouter().navTo("detail", {
					custContextPath: this.sCustContextPath
				}, true);
			}

			this.getView().setModel(oInitialViewModel, "paymentViewModel");
			this.clearModelData();
		},
		isEligibleForReturnOrder: function () {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var payableAmount = oViewModel.getProperty("/payableAmount");

			if (this.action === this.getResourceBundle().getText("actionOrderReturn") && payableAmount > 0) {
				return false;
			} else {
				return true;
			}
		},

		triggerReturnOrder: function () {
			var oThis = this;
			var oModel = this.getModel();
			var oViewModel = this.getView().getModel("paymentViewModel");
			var orderReturnModel = this.getOwnerComponent().getModel("orderReturnModel");
			var itemSet = orderReturnModel.getProperty("/ReqItemSet");
			var returnOrderRequest = {};
			var invoiceID = orderReturnModel.getProperty("/invoiceID");
			invoiceID = this.invoiceId;
			var documentCurrency = orderReturnModel.getProperty("/DocumentCurrency");
			var soldToParty = orderReturnModel.getProperty("/SoldToPartyID");
			var salesOrg = orderReturnModel.getProperty("/SalesOrganization");
			var distributionChannel = orderReturnModel.getProperty("/DistributionChannel");
			var division = orderReturnModel.getProperty("/Division");
			var paymentTermCode = orderReturnModel.getProperty("/PaymentTermCode");
			var purchaseOrderNo = orderReturnModel.getProperty("/PurchaseOrderNumber");
			var headerPartnerSet = orderReturnModel.getProperty("/HeaderPartnerSet");
			var returningReason = orderReturnModel.getProperty("/returningReason");
			var salesOrderID = oViewModel.getProperty("/paymentVbeln");
			var payableAmount = oViewModel.getProperty("/payableAmount");
			payableAmount = parseFloat(payableAmount);

			returnOrderRequest.SalesOrderID = salesOrderID;

			returnOrderRequest.DocumentCurrency = documentCurrency;
			returnOrderRequest.SoldToPartyID = soldToParty;
			returnOrderRequest.SalesOrganization = salesOrg;
			returnOrderRequest.DistributionChannel = distributionChannel;
			returnOrderRequest.Division = division;
			returnOrderRequest.PaymentTermCode = paymentTermCode;
			returnOrderRequest.PurchaseOrderNumber = purchaseOrderNo;

			if (payableAmount <= 0) {
				returnOrderRequest.Zzpaidfull = "X";
			}
			returnOrderRequest.SalesOrderTypeCode = "YIR";
			returnOrderRequest.VbelnRef = invoiceID;
			returnOrderRequest.Augru = returningReason;
			returnOrderRequest.HeaderPartnerSet = headerPartnerSet;

			returnOrderRequest.ItemSet = itemSet;

			oModel.setUseBatch(false);
			oModel.create("/HeaderSet", returnOrderRequest, {
				success: function (data) {
					oThis.onReturnOrderSuccessCallback(data);
				},
				error: function (error) {
					oThis.onReturnOrderErrorCallback(error);
				}
			});

		},
		onReturnOrderSuccessCallback: function (data) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var selectedDocument = oViewModel.getProperty("/vbeln");
			var salesOrderID = data.SalesOrderID;
			var orderMsg = this.getResourceBundle().getText("returnOrderCreated", [salesOrderID]);
			var isPrintReceiptSelected = oViewModel.getProperty("/PrintReceipt");
			var isEmailSelected = oViewModel.getProperty("/EmailReceipt");
			var oModel = this.getModel();
			oModel.setUseBatch(true);

			if (isPrintReceiptSelected || isEmailSelected) {
				jQuery.sap.delayedCall(5000, this, function () {
					this.triggerReceipt(salesOrderID, orderMsg);
				});
			} else {
				oViewModel.setProperty("/busy", false);
				this.navToHomeScreen(orderMsg, selectedDocument);
			}
		},
		onReturnOrderErrorCallback: function (error) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			oViewModel.setProperty("/busy", false);
			var oModel = this.getModel();
			var errorResponse = JSON.parse(error.responseText);
			var errorMessage = errorResponse.error.message.value;
			sap.m.MessageToast.show(
				errorMessage, {
					duration: 6000
				});
			oModel.setUseBatch(true);
		},
		triggerReceipt: function (documentNo, orderMsg) {
			var oViewModel = this.getView().getModel("paymentViewModel");
			var isPrintReceiptSelected = oViewModel.getProperty("/PrintReceipt");
			var isEmailSelected = oViewModel.getProperty("/EmailReceipt");
			var nacha = "1";
			var email = "";
			var customerEmail = oViewModel.getProperty("/email");
			if (isPrintReceiptSelected) {
				nacha = "1";
			}
			if (isEmailSelected) {
				nacha = "7";
				if (customerEmail) {
					email = customerEmail;
				}
			}
			if (isPrintReceiptSelected & isEmailSelected) {
				nacha = "1";
			}
			var oModel = this.getModel();
			oModel.callFunction(
				"/PrintL", {
					method: "POST",
					urlParameters: {
						"Objky": documentNo,
						"Nacha": nacha,
						"PrintInd": "PR",
						"Email": email
					},
					success: function () {
						oViewModel.setProperty("/busy", false);
					},
					error: function (error) {
						oViewModel.setProperty("/busy", false);
						var errorResponse = JSON.parse(error.responseText);
						var errorMessage = errorResponse.error.message.value;
						sap.m.MessageToast.show(
							errorMessage, {
								duration: 6000
							});
					}
				}
			);
			this.navToHomeScreen(orderMsg);
		},
		clearModelData: function () {
			this.getOwnerComponent().setModel(models.createChangeOrderHeaderModel(), "changeOrderHeaderModel");
			this.getOwnerComponent().setModel(models.createChangeOrderDeleteItemsModel(), "changeOrderDeleteItemsModel");
			this.getOwnerComponent().setModel(models.createOrderReturnModel(), "orderReturnModel");
		},

		onNavBack: function () {
			this.handleCancel();
		},
		handleCancel: function () {
			var oInitialViewModel = this.createViewModel();
			if (this.action) {
				var oViewModel = this.getView().getModel("paymentViewModel");
				var selectedDocument = oViewModel.getProperty("/vbeln");
				if (this.action === this.getResourceBundle().getText("actionChangeOrder")) {
					this.getRouter().navTo("changeOrder", {
						documentID: selectedDocument,
						custContextPath: this.sCustContextPath,
						context: "payment",
						paymentInd: this.paymentInd
					}, true);

				} else if (this.action === this.getResourceBundle().getText("actionOrderReturn")) {
					this.getRouter().navTo("orderReturn", {
						documentID: selectedDocument,
						invoiceID: this.invoiceId,
						custContextPath: this.sCustContextPath,
						context: "payment"
					}, true);
				} else {
					this.getRouter().navTo("detail", {
						custContextPath: this.sCustContextPath
					}, true);
				}
			} else {
				this.getRouter().navTo("detail", {
					custContextPath: this.sCustContextPath
				}, true);
			}

			this.getView().setModel(oInitialViewModel, "paymentViewModel");
		}
	});

});