sap.ui.define([
    "sap/ui/core/UIComponent",
    "iifcl/cml/cmlmisapp/model/models"
], function (UIComponent, models) {
    "use strict";

    return UIComponent.extend("iifcl.cml.cmlmisapp.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function () {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // DO NOT initialize router while we have no routing config
            // var oRouter = this.getRouter();
            // if (oRouter) {
            //     oRouter.initialize();
            // }
        }
    });
});
