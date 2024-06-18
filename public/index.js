import { MQTTService } from './mqttService.js';

/*

hub : {
    gid: "1234",
    status : "online",
    modules: [
        {
            gid: "1234",
            dataFields: [
                'potentiometer': 100
            ],
            strategy: "always",
            threshold: 100
        }
    ]
}
*/

let hubs = [];
let mqttService = null;
const dataFields = ["temperature", "humidity", "boolean", "potentiometer"];
// send_interval

fetch("/mqttConnDetails", {
    method: "GET",
    headers: {
        "Content-Type": "application/json; charset=UTF-8",
    },
}).then((response) => {
    return response.json();
}).then((data) => {
    initMqtt(data);
}).catch((error) => console.log("Error: ", error));

function initMqtt(connectionData) {
    mqttService = new MQTTService(connectionData.mqttServer, connectionData.mqttUsername, connectionData.mqttPassword, {
        onMessage: onMessage
    });
    mqttService.connect();

    mqttService.subscribe("+/status");
}

class Module {
    constructor(gid, parent, parentHub) {
        this.gid = gid;
        this.dataFields = [];
        this.strategy = "";
        this.delayInterval = 0;
        this.parent = parent;
        this.parentHub = parentHub;
        this.mainElement = null;
        this.create();
    }

    continue(topicArray, message) {
        console.log(topicArray, message.toString());

        if (topicArray.length === 0) return;

        if (topicArray[0] === "strategy") {
            this.changeStrategy(message.toString());
            return;
        }
        if (topicArray[0] === "send_interval") {
            this.changeSendInterval(message.toString());
            return;
        }
    }

    changeSendInterval(newInterval) {
        this.delayInterval = newInterval;
        const intervalField = this.mainElement.querySelector(".delay-interval");
        if (intervalField) {
            intervalField.value = newInterval;
        }
    }

    changeStrategy(strategy) {
        this.strategy = strategy;
        this.mainElement.querySelector(".strategy").innerText = strategy;
        // update the strategy div depending on the module type and strategy

        if (this.strategy === "always") {
            this.mainElement.querySelector(".strategy-options").innerHTML = `
                <p> Interval (ms): <input type="text" class="delay-interval" value="${this.delayInterval}"></p>
            `;
            const changeDelayButton = document.createElement("button"); 
            changeDelayButton.innerText = "Change Interval";
            changeDelayButton.addEventListener("click", () => {
                mqttService.publish(`${this.parentHub.gid}/B2H/${this.gid}/send_interval`, this.mainElement.querySelector(".delay-interval").value);
            });
            this.mainElement.querySelector(".strategy-options").appendChild(changeDelayButton);
        } else {
            this.createThresholdField();
        }
    }

    changeData(dataField, value) {
        this.dataFields[dataField] = value;
        this.mainElement.querySelector(`.${dataField}`).innerText = `${value}`;
    }

    create() {
        console.log("Creating module", this.parentHub.gid);
        const moduleArticle = document.createElement("article");
        moduleArticle.id = `${this.gid}`;
        moduleArticle.className = "module";
        const moduleButton = document.createElement("button");
        moduleButton.className = "collapsible active";
        moduleButton.innerHTML = `<h3>Module: ${this.gid}</h3>`;
        moduleButton.addEventListener("click", toggleCollapsible, true);
        const moduleDiv = document.createElement("div");
        moduleDiv.classList.add("module-content");

        moduleDiv.appendChild(this.createDataFields());

        const refreshButton = document.createElement("button");
        refreshButton.innerText = "Refresh";
        refreshButton.addEventListener("click", () => {
            mqttService.publish(`${this.parentHub.gid}/B2H/${this.gid}/force_update`, "");
        });
        moduleDiv.appendChild(refreshButton);

        const strategyField = document.createElement("p");
        strategyField.innerHTML = `Strategy: <span class="strategy">${this.strategy}</span>`;
        moduleDiv.appendChild(strategyField);
        const changeStrategyButton = document.createElement("button");
        changeStrategyButton.innerText = "Change Strategy";
        changeStrategyButton.addEventListener("click", () => {
            mqttService.publish(`${this.parentHub.gid}/B2H/${this.gid}/strategy`, this.strategy == "always" ? "on_change" : "always");
        });
        moduleDiv.appendChild(changeStrategyButton);
        const strategyDiv = document.createElement("div");
        strategyDiv.className = "strategy-options";
        moduleDiv.appendChild(strategyDiv);

        moduleArticle.appendChild(moduleButton);
        moduleArticle.appendChild(moduleDiv);
    
        this.mainElement = moduleArticle;
        this.parent.appendChild(moduleArticle);
    }

    createDataFields() {}

    createThresholdField() {}
}

class BooleanModule extends Module {
    constructor(gid, parent, parentHub) {
        super(gid, parent, parentHub);
    }

    continue(topicArray, message) {
        super.continue(topicArray, message);

        if (topicArray[0] === "boolean") {
            this.changeData("boolean", message.toString());
        }
    }

    createDataFields() {
        const booleanField = document.createElement("div");
        booleanField.innerHTML = `<p>Boolean: <span class="boolean">${this.dataFields.boolean}</span></p>`;
        return booleanField;
    }

    createThresholdField() {
        this.mainElement.querySelector(".strategy-options").innerHTML = '';
    }
}

class PotentiometerModule extends Module {
    constructor(gid, parent, parentHub) {
        super(gid, parent, parentHub);
        this.threshold = 0;
    }
    continue(topicArray, message) {
        super.continue(topicArray, message);

        if (topicArray[0] === "potentiometer") {
            this.changeData("potentiometer", message.toString());
        } else if (topicArray[0] === "threshold") {
            this.changeThreshold(message.toString());
        }
    }

    createDataFields() {
        const potentiometerField = document.createElement("div");
        potentiometerField.innerHTML = `<p>Potentiometer: <span class="potentiometer">${this.dataFields.potentiometer}</span></p>`;
        return potentiometerField;
    }

    changeThreshold(newThreshold) {
        this.threshold = newThreshold;
        const thresholdField = this.mainElement.querySelector(".threshold");
        if (thresholdField) {
            thresholdField.value = newThreshold;
        }
    }

    createThresholdField() {
        const thresholdOptionsDiv = this.mainElement.querySelector(".strategy-options")
        thresholdOptionsDiv.innerHTML = '';
        const thresholdButton = document.createElement("button");
        thresholdButton.innerText = "Change Threshold";
        thresholdButton.addEventListener("click", () => {
            mqttService.publish(`${this.parentHub.gid}/B2H/${this.gid}/threshold`, this.mainElement.querySelector(".threshold").value);
        });

        thresholdOptionsDiv.innerHTML += `<p>Threshold: <input type="text" class="threshold" value="${this.threshold}"></p>`;
        thresholdOptionsDiv.appendChild(thresholdButton);
    }
}

class TemperatureHumidityModule extends Module {
    constructor(gid, parent, parentHub) {
        super(gid, parent, parentHub);
        this.temperatureThreshold = 0;
        this.humidityThreshold = 0;
    }
    continue(topicArray, message) {
        super.continue(topicArray, message);

        if (topicArray[0] === "temperature") {
            this.changeData("temperature", message.toString());
        }
        if (topicArray[0] === "humidity") {
            this.changeData("humidity", message.toString());
        }
        if (topicArray[0] === "threshold") {
            this.changeThreshold(message.toString());
        }
    }

    createDataFields() {
        const temperatureHumidityField = document.createElement("div");
        temperatureHumidityField.innerHTML = `<p>Temperature: <span class="temperature">${this.dataFields.temperature}</span></p><p>Humidity: <span class="humidity">${this.dataFields.humidity}</span></p>`;
        return temperatureHumidityField;
    }

    changeThreshold(newThreshold) {
        const splitThreshold = newThreshold.split("\n");
        this.temperatureThreshold = splitThreshold[0];
        this.humidityThreshold = splitThreshold[1];
        const thresholdField = this.mainElement.querySelector(".temperature-threshold");
        if (thresholdField) {
            thresholdField.value = this.temperatureThreshold;
        }
        const humidityField = this.mainElement.querySelector(".humidity-threshold");
        if (humidityField) {
            humidityField.value = this.humidityThreshold;
        }
    }

    createThresholdField() {
        const thresholdOptionsDiv = this.mainElement.querySelector(".strategy-options")

        const thresholdButton = document.createElement("button");
        thresholdButton.innerText = "Change Threshold";
        thresholdButton.addEventListener("click", () => {
            console.log("Publishing threshold");
            mqttService.publish(`${this.parentHub.gid}/B2H/${this.gid}/threshold`, `${this.mainElement.querySelector(".temperature-threshold").value}\n${this.mainElement.querySelector(".humidity-threshold").value}`);
        });
        thresholdOptionsDiv.innerHTML = `
        <p>Temperature threshold: <input type="text" class="temperature-threshold" value="${this.temperatureThreshold}"></p>
        <p>Humidity threshold: <input type="text" class="humidity-threshold" value="${this.humidityThreshold}"></p>
        `;
        thresholdOptionsDiv.appendChild(thresholdButton);
    }
}

class Hub {
    constructor(gid) {
        this.gid = gid;
        this.modules = [];
        this.status = "offline";
        this.mainElement = null;
        this.create();
    }

    continue(topicArray, message) {
        if (topicArray[0] === "status") {
            this.changeStatus(message.toString());
            return;
        }

        let module = this.modules.find(module => module.gid === topicArray[1]);
        if (!module) {
            module = createModule(topicArray[1], this.mainElement.querySelector("div"), this);
            this.modules.push(module);
        }
        module.continue(topicArray.splice(2), message);
    }

    changeStatus(status) {
        this.status = status;
        this.mainElement.querySelector(".status").innerText = status;
    }

    create() {
        const dashboard = document.getElementById("dashboard");
        const hubSection = document.createElement("section");
        hubSection.id = `${this.gid}`;
        hubSection.className = "hub";
        const hubButton = document.createElement("button");
        hubButton.className = "collapsible active";
        hubButton.innerHTML = `<h2>Hub: ${this.gid}</h2><p>Status: <span class="status">${this.status}</span></p>`;
        hubButton.addEventListener("click", toggleCollapsible, true);
        const hubDiv = document.createElement("div");
    
        hubSection.appendChild(hubButton);
        hubSection.appendChild(hubDiv);
   
        this.mainElement = hubSection;
        dashboard.appendChild(hubSection);
    }
}

function onMessage(topic, message) {
    // we got a new message; 
    // check if we have the hub, otherwise create one and add it to the list
    const splitTopic = topic.split("/");

    if (splitTopic.length < 1) {
        return;
    }

    let hub = hubs.find(hub => hub.gid === splitTopic[0]);
    if (!hub) {
        mqttService.subscribe(`${splitTopic[0]}/H2B/#`)
        hub = new Hub(splitTopic[0]);
        hubs.push(hub);
    }
    hub.continue(splitTopic.splice(1), message);

    // if (splitTopic.length < 2) {
    //     return;
    // }

    // if (splitTopic[1] === "status") {
    //     hub.status = message.toString();
    //     console.log(hubs);
    //     return;
    // }

    // if (splitTopic.length < 3) {
    //     return;
    // }

    // // check if we have the module, otherwise create one and add it to the list
    // let module = hub.modules.find(module => module.gid === splitTopic[2]);
    // if (!module) {
    //     module = {
    //         gid: splitTopic[2],
    //     };
    //     hub.modules.push(module);
    // }

    // if (splitTopic.length < 4) {
    //     return;
    // }

    // const field = splitTopic[3];
    // if (dataFields.includes(field)) {
    //     module[field] = message.toString();
    // }

    // console.log(hubs);
}

function toggleCollapsible(event) {
    let curr_element = event.target;
    while (curr_element.tagName != "BUTTON") {
        curr_element = curr_element.parentElement;
    }
    curr_element.classList.toggle("active");
    const content = curr_element.nextElementSibling;
    content.classList.toggle("hidden");
}

function createModule(gid, parent, parentHub) {
    const firstNumber = (parseInt(gid.split(":")[0][0], 16));
    if (firstNumber === 0b0001) {
        return new BooleanModule(gid, parent, parentHub);
    } else if (firstNumber === 0b0010) {
        return new PotentiometerModule(gid, parent, parentHub);
    } else if (firstNumber === 0b0101) {
        return new TemperatureHumidityModule(gid, parent, parentHub);
    }
    return null;
}