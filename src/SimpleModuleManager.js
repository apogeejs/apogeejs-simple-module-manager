/** This class manages addition and removal of apogee modules for a standard web platform apogee application. 
 * Options:
 *    - openLinkFromApp: defaults to false. If true, opening the workspace and web links happens from the app context. Otherwise
 *        it is done directly from the remote window.
 * 
*/
export default class SimpleModuleManager {
    constructor(app,options) {
        this.app = app;
        this.options = options ? options : {};
        this.childWindow = null;
        this.childWindowId = apogeeutil.getUniqueString();
        window.addEventListener("message",event => this.receiveMessage(event));
    }

    /** This opens the module manager window and sets up communication with it. */
    async openModuleManager() {
        try {
            let appModulesData = await this.getAppModulesData();
            this.childWindow = window.open(this.getModuleManagerUrl(appModulesData), 'Module Manager - ' + this.childWindowId, 'width=768,height=768,left=200,top=100');
        }
        catch(error) {            
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error opening module manager: " + errorMsg);
        }
    }

    //==========================
    // Protected Methods
    //==========================

    async getAppModulesData() {
        let referenceManager = this.app.getWorkspaceManager().getReferenceManager();
        let moduleList = referenceManager.getModuleList(this.getModuleType());
        let appModuleData = {
            app: "TBD",
            version: "TBD",
            moduleType: this.getModuleType(),
            modules: moduleList
        }
        return appModuleData;
    }

    getModuleManagerUrl(appModulesData) {
        let appModules = JSON.stringify(appModulesData);
        let moduleType = this.getModuleType();
        let windowId = this.childWindowId;
        let callingUrl = location.protocol + "//" + location.host + location.pathname;
        let openWindow = this.options.openLinkFromApp ? "app" : "local";
        return REMOTE_MODULE_MANAGER_URL + `?appModules=${appModules}&windowId=${windowId}&moduleType=${moduleType}&callingUrl=${callingUrl}&openWindow=${openWindow}`;
    }

    getModuleType() {
        return WEB_MODULE_TYPE;
    }

    receiveMessage(event) {
        //make sure this is from the right window
        if(!this.isMyMessage(event)) return;

        let commandData = event.data.value.commandData; 
        switch(event.data.message) {
            case "loadModule": 
                this.loadModuleCommand(commandData);
                break;

            case "unloadModule": 
                this.unloadModuleCommand(commandData);
                break;

            case "updateModule": 
                this.updateModuleCommand(commandData);
                break;

            case "openWorkspace": 
                this.openWorkspaceCommand(commandData);
                break;

            case "openLink": 
                this.openLinkCommand(commandData);
                break;
        }
    }

    async sendModulesUpdate() {
        if(this.childWindow) {
            let appModulesData = await this.getAppModulesData();
            this.childWindow.postMessage({message: "appModules", value: appModulesData},REMOTE_MODULE_MANAGER_URL);
        }
    }

    isMyMessage(event) {
        let messageData = event.data.value;
        return ((messageData)&&(messageData.windowId == this.childWindowId));
    }

    //--------------------
    // message handlers
    //--------------------

    loadModuleCommand(commandData) {
        if(!commandData.moduleIdentifier) {
            apogeeUserAlert("Load module failed: missing module identifier.");
            return;
        }
        try {
            let cmdDone = this.loadModule(commandData.moduleIdentifier,commandData.moduleName);
            if(cmdDone) {
                this.sendModulesUpdate();
            }
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error adding module: " + errorMsg);
        }
    }

    updateModuleCommand(commandData) {
        if(!commandData.oldIdentifier) {
            apogeeUserAlert("Update module failed: missing original module identifier.");
            return;
        }
        if(!commandData.newIdentifier) {
            apogeeUserAlert("Update module failed: missing new module identifier.");
            return;
        }
        try {
            let cmdDone = this.updateModule(commandData.newIdentifier,commandData.oldIdentifier,commandData.moduleName);
            if(cmdDone) {
                this.sendModulesUpdate();
            }
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error adding module: " + errorMsg);
        }
    }

    unloadModuleCommand(commandData) {
        if(!commandData.moduleIdentifier) {
            apogeeUserAlert("Unload module failed: missing module identifier.");
            return;
        }

        try {
            let cmdDone = this.unloadModule(commandData.moduleIdentifier);
            if(cmdDone) {
                this.sendModulesUpdate();
            }
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error removing module: " + errorMsg);
        }
    }

    openWorkspaceCommand(commandData) {
        let workspaceUrl = commandData.workspaceUrl;
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

    openLinkCommand(commandData) {
        let linkUrl = commandData.linkUrl;
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

    //--------------------------
    // Command Execution Functions
    //--------------------------

    loadModule(moduleIdentifier,moduleName) {
        let commandData = {};
        commandData.type = "addLink";
        commandData.data = {
            entryType: this.getModuleType(),
            url: moduleIdentifier, //url for ES module, module name for NPM module
            name: moduleName
        };
        return this.app.executeCommand(commandData);
    }

    /** This updates the module, changing the "identifier" which is the url for an ES modulea and the
     * module name for an NPM module. This is only intended for ES modules, to update the url. To update
     * an NPM module it must be reinstalled in the app, and the reference entry does not change. */
    updateModule(newModuleIdentifier,oldModuleIdentifier,moduleName) {
        let commandData = {};
        commandData.type = "updateLink";
        commandData.data = {
            entryType: this.getModuleType(),
            url: newModuleIdentifier, //url for ES module, module name for NPM module
            name: moduleName,
        };
        commandData.initialUrl = oldModuleIdentifier; //url for ES module, module name for NPM module
        return this.app.executeCommand(commandData);
    }

    unloadModule(moduleIdentifier) {
        let commandData = {};
        commandData.type = "deleteLink";
        commandData.entryType = this.getModuleType();
        commandData.url = moduleIdentifier; //note this is module name for npm
        return this.app.executeCommand(commandData);
    }

    

}


const REMOTE_MODULE_MANAGER_URL = "http://localhost:8888/apogeejs-admin/dev/moduleManager/moduleMgr.html";
const WEB_MODULE_TYPE = "web apogee module";