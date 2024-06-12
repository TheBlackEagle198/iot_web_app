export class MQTTService {
    constructor(host, username, password, callbacks) {
        this.client = null;
        this.host = host;
        this.username = username;
        this.password = password;
        this.callbacks = callbacks;
    }

    connect() {
        this.client = mqtt.connect(this.host, {username: this.username, password: this.password});

        this.client.on('connect', () => {
            console.log('Connected to MQTT server:', this.host);
            if (this.callbacks && this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        });

        this.client.on('error', (error) => {
            console.log('MQTT Error: ', error);
            if (this.callbacks && this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        });

        this.client.on('message', (topic, message) => {
            console.log('Received message:', topic, message.toString());
            if (this.callbacks && this.callbacks.onMessage) {
                this.callbacks.onMessage(topic, message);
            }
        });
    }

    publish(topic, message, options, callback) {
        this.client.publish(topic, message, options, callback);
    }

    subscribe(topic, options, callback) {
        this.client.subscribe(topic, options, callback);
    }

    unsubscribe(topic) {
        this.client.unsubscribe(topic);
    }
}