sap.ui.define([
	], function () {
		"use strict";
		return {
		groupByCity : function () {
			return function (oContext) {
					return {
						key:  oContext.getProperty("City1"),
						text: oContext.getProperty("City1")
					};
				};
			}

		};
	}
);