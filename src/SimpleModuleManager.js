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
            this.childWindow = window.open(this.getModuleManagerUrl(), 'Module Manager - ' + this.childWindowId, 'width=768,height=768,left=200,top=100');
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

    async getInitModulesData() {
        let initModulesData = {
            platform: this.getPlatform(),
            repositories: [
                "http://localhost:8888/apogeejs-admin/dev/moduleManager/moduleDataTest.json"
            ]
        }
        return initModulesData;
    }

    async getAppStatusData() {
        let referenceManager = this.app.getWorkspaceManager().getReferenceManager();
        let moduleList = referenceManager.getModuleList(MODULE_TYPE);
        let appStatusData = {
            app: "TBD",
            version: "TBD",
            loaded: moduleList
        }

        return appStatusData;
    }

    getModuleManagerUrl() {
        let windowId = this.childWindowId;
        let callingUrl = location.protocol + "//" + location.host + location.pathname;

        //return REMOTE_MODULE_MANAGER_URL + `?windowId=${windowId}&platform=${platform}&callingUrl=${callingUrl}`;
        let connector =  (REMOTE_MODULE_MANAGER_URL.indexOf("?") >= 0) ? "&" : "?";
        return `${REMOTE_MODULE_MANAGER_URL}${connector}windowId=${windowId}&callingUrl=${callingUrl}`;
    }

    getPlatform() {
        return ES_PLATFORM;
    }

    receiveMessage(event) {
        //make sure this is from the right window
        if(!this.isMyMessage(event)) return;

        let commandData = event.data.value.commandData; 
        switch(event.data.message) {
            case "opened":
                this.sendInitData();
                this.sendStatusUpdate(); 
                break;

            case "loadApogeeModule": 
                this.loadModuleCommand(commandData);
                break;

            case "unloadApogeeModule": 
                this.unloadModuleCommand(commandData);
                break;

            case "updateApogeeModule": 
                this.updateModuleCommand(commandData);
                break;

            case "openWorkspace": 
                this.openWorkspaceCommand(commandData);
                break;

            case "openLink": 
                this.openLinkCommand(commandData);
                break;

            case "closed":
                console.log("closed");
                break;
        }
    }

    async sendInitData() {
        if(this.childWindow) {
            let initModulesData = await this.getInitModulesData();
            this.childWindow.postMessage({message: "initModules", value: initModulesData},REMOTE_MODULE_MANAGER_URL);
        }
    }

    async sendStatusUpdate() {
        if(this.childWindow) {
            let appStatusData = await this.getAppStatusData();
            this.childWindow.postMessage({message: "appStatus", value: appStatusData},REMOTE_MODULE_MANAGER_URL);
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
        try {
            let cmdDone = this.loadModule(commandData);
            if(cmdDone) {
                this.sendStatusUpdate();
            }
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error adding module: " + errorMsg);
        }
    }

    updateModuleCommand(commandData) {
        if(!commandData.entryId) {
            apogeeUserAlert("Update module failed: missing module entry ID.");
            return;
        }
        if(!commandData.referenceData) {
            apogeeUserAlert("Update module failed: missing new module reference data.");
            return;
        }
        try {
            let cmdDone = this.updateModule(commandData.entryId,commandData.referenceData);
            if(cmdDone) {
                this.sendStatusUpdate();
            }
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let errorMsg = error.message ? error.message : error.toString();
            apogeeUserAlert("Error adding module: " + errorMsg);
        }
    }

    unloadModuleCommand(commandData) {
        if(!commandData.entryId) {
            apogeeUserAlert("Unload module failed: missing module entry ID.");
            return;
        }

        try {
            let cmdDone = this.unloadModule(commandData.entryId);
            if(cmdDone) {
                this.sendStatusUpdate();
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

    loadModule(referenceData) {
        let commandData = {};
        commandData.type = "addLink";
        commandData.entryType = MODULE_TYPE
        commandData.data = referenceData
        return this.app.executeCommand(commandData);
    }

    /** This updates the module, changing the "identifier" which is the url for an ES modulea and the
     * module name for an NPM module. This is only intended for ES modules, to update the url. To update
     * an NPM module it must be reinstalled in the app, and the reference entry does not change. */
    updateModule(entryId,newReferenceData) {
        let commandData = {};
        commandData.type = "updateLink";
        commandData.id = entryId;
        commandData.data = newReferenceData;
        return this.app.executeCommand(commandData);
    }

    unloadModule(entryId) {
        let commandData = {};
        commandData.type = "deleteLink";
        commandData.id = entryId;
        return this.app.executeCommand(commandData);
    }

    

}


const REMOTE_MODULE_MANAGER_URL = "http://localhost:8888/apogeejs-web-app/web/apogeeDev.html?url=http://localhost:8888/apogeejs-admin/dev/moduleManager/airplaneModuleManagerWorkspace.json";
//const REMOTE_MODULE_MANAGER_URL = "http://localhost:8889/apogeejs-admin/dev/moduleManager/moduleMgr.html";
const MODULE_TYPE = "apogee module";
const ES_PLATFORM = "es";
const NODE_PLATFORM = "node";