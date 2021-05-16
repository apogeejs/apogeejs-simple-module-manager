/** This class manages addition and removal of apogee modules for a standard web platform apogee application. */
export default class SimpleModuleManager {
    constructor(app) {
        this.app = app;
        this.remoteWindow = null;
        this.messageListener = event => this.receiveMessage(event);
    }

    /** This opens the module manager window and sets up communication with it. */
    openModuleManager() {
        try {
            window.addEventListener("message",this.messageListener);
            this.remoteWindow = window.open(this.getModuleManagerUrl(), 'Module Manager', 'width=512,height=512,left=200,top=100');
            return true;
        }
        catch(error) {
            window.removeEventListener("message",this.messageListener);
            this.remoteWindow = null;
            
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error opening module manager: " + errorMsg);
            return false;
        }
    }

    //==========================
    // Protected Methods
    //==========================

    getModuleManagerUrl() {
        return REMOTE_WEB_MODULE_MANAGER_URL;
    }

    getModuleType() {
        return WEB_MODULE_TYPE;
    }

    receiveMessage(event) {
        switch(event.data.message) {
            case "loadModule": 
                this.loadModuleCommand(event.data.value);
                break;

            case "unloadModule": 
                this.unloadModuleCommand(event.data.value);
                break;

            case "updateModule": 
                this.updateModuleCommand(event.data.value);
                break;

            case "openWorkspace": 
                this.openWorkspaceCommand(event.data.value);
                break;

            case "openLink": 
                this.openLinkCommand(event.data.value);
                break;

            case "closeModuleManager":
                this.closeModuleManager();
                break;
        }
    }

    loadModuleCommand(messageData) {
        if(!messageData.moduleIdentifier) {
            apogeeUserAlert("Load module failed: missing module identifier.");
            return;
        }
        try {
            this.loadModule(messageData.moduleIdentifier,messageData.moduleName);
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error adding module: " + errorMsg);
        }
    }

    updateModuleCommand(messageData) {
        if(!messageData.oldIdentifier) {
            apogeeUserAlert("Update module failed: missing original module identifier.");
            return;
        }
        if(!messageData.newIdentifier) {
            apogeeUserAlert("Update module failed: missing new module identifier.");
            return;
        }
        try {
            this.updateModule(messageData.newIdentifier,messageData.oldIdentifier);
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error adding module: " + errorMsg);
        }
    }

    unloadModuleCommand(messageData) {
        if(!messageData.moduleIdentifier) {
            apogeeUserAlert("Unload module failed: missing module identifier.");
            return;
        }

        try {
            this.unloadModule(messageData.moduleIdentifier);
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error removing module: " + errorMsg);
        }
    }

    openWorkspaceCommand(messageData) {
        let workspaceUrl = messageData.workspaceUrl;
        if(!workspaceUrl) {
            apogeeUserAlert("Open workspace failed: missing workspace URL.");
            return;
        }

        try {
            apogeeplatform.spawnWorkspaceFromUrl(workspaceUrl);
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error opening workspace: " + errorMsg);
        }
    }

    openLinkCommand(messageData) {
        let linkUrl = messageData.linkUrl;
        if(!linkUrl) {
            apogeeUserAlert("Open link failed: missing link URL.");
            return;
        }

        try {
            apogeeplatform.openWebLink(linkUrl);
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error opening link: " + errorMsg);
        }
    }

    closeModuleManager() {
        window.removeEventListener("message",this.messageListener);
        this.remoteWindow = null;
    }

    //--------------------------
    // Command Execution Functions
    //--------------------------


    loadModule(moduleIdentifier,moduleName) {
        let commandData = {};
        commandData.type = "addLink";
        commandData.data = {
            entryType: this.getModuleType(),
            url: moduleIdentifier, //url for ES module, module name for NPM module
            nickname: moduleName
        };
        return this.app.executeCommand(commandData);
    }

    /** This updates the module, changing the "identifier" which is the url for an ES modulea and the
     * module name for an NPM module. This is only intended for ES modules, to update the url. To update
     * an NPM module it must be reinstalled in the app, and the reference entry does not change. */
    updateModule(newModuleIdentifier,oldModuleIdentifier) {
        let commandData = {};
        commandData.type = "updateLink";
        commandData.data = {
            entryType: this.getModuleType(),
            newUrl: newModuleIdentifier, //url for ES module, module name for NPM module
        };
        commandData.initialUrl = oldModuleIdentifier; //url for ES module, module name for NPM module
        return this.app.executeCommand(commandData);
    }

    unloadModule(moduleIdentifier) {
        let commandData = {};
        commandData.type = "removeLink";
        commandData.data = {
            entryType: this.getModuleType(),
            url: moduleIdentifier //url for ES module, module name for NPM module
        };
        return this.app.executeCommand(commandData);
    }

}


const REMOTE_WEB_MODULE_MANAGER_URL = "http://localhost:8888/test/modules/moduleMgr.html";
const WEB_MODULE_TYPE = "es module";