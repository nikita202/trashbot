const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const token = "913804810:AAFxSN8NDv43zOSeI8rFIOpa8bYhWfhuNEk";
const Bot = new TelegramBot(token, {polling: true});
const limit = 20;
const time = 60 * 1000;

const version = "0.0.2";
const patchNotes = Object.freeze({
    "0.0.1": "Первый релиз",
    "0.0.2": "Добавлен парсер комманд",

});

const Users = {
    _users: {},
    _filename: ".user_saves",
    hasUser(v) {
        return this._users.hasOwnProperty(v);
    },
    addUser(chat_id, obj) {
        this._users[chat_id] = obj;
        this.saveFile();
    },
    deleteUser(chat_id) {
        delete this._users[chat_id];
        this.saveFile();
    },
    getUser(chat_id) {
        return this._users[chat_id];
    },
    forEach(func) {
        for (let chat_id in this._users) if (this._users.hasOwnProperty(chat_id)) {
            func(chat_id, this.getUser(chat_id));
        }
    },
    saveFile() {
        fs.writeFile(this._filename, JSON.stringify(this._users), {}, err => {
            if (err) console.log(err);
        });
    },
    loadFile() {
        try {
            this._users = JSON.parse(fs.readFileSync(this._filename, {}).toString());
        } catch (e) {
        }
    }
};

function getUserWrapperId(user, msg_id) {
    for (let prop in user.reply_table) if (user.reply_table.hasOwnProperty(prop)) {
        if (user.reply_table[prop] == msg_id) return prop;
    }
    return null;
}

Users.loadFile();

const CommandProcessor = new (require("./commandprocessor")) ([
    {
        name: "list_members",
        description: "",
        adminOnly: false,
        usage: "/list_members",
        action: function (msg, user, arguments, self) {
            let result = "";
            let i = 1;
            Users.forEach((chat_id, user) => {
                result += i + ") " + user.user_data.first_name + " ";
                if (user.user_data.last_name) result += user.user_data.last_name + " ";
                if (user.user_data.username) result += "@" + user.user_data.username + " ";
                result += "\n";
                i++;
            });
            Bot.sendMessage(user.chat_id, result, {
                reply_to_message_id: msg.message_id
            });
        }
    },
    {
        name: "unsub",
        description: "",
        adminOnly: false,
        usage: "/unsub",
        action: function (msg, user, arguments, self) {
            Bot.sendMessage(user.chat_id, "ну и иди нафиг(((", {
                reply_to_message_id: msg.message_id
            });
            Users.deleteUser(user.chat_id);
        }
    }
]);

Bot.on("text", msg => {
    let chat_id = msg.chat.id;

    if (msg.chat.type !== "private") {
        Bot.sendMessage(chat_id, "иди нахрен, только лс");
    } else {
        if (Users.hasUser(chat_id)) {
            let user = Users.getUser(chat_id);
            if (msg.text.startsWith("/")) {
                CommandProcessor.process(msg.text.slice(1), msg, user);
            } else {
                if (user.timestamp + time < +Date.now()) {
                    user.timestamp = +Date.now();
                    user.msg_count = 0;
                }
                if (user.msg_count > limit) {
                    Bot.sendMessage(chat_id, "ты отправил слишком много сообщений, жди еще " + (user.timestamp + time - Date.now()) / 1000 + " секунд");
                } else {
                    user.msg_count++;
                    Users.forEach((user_chat_id, current_user) => {
                        if (user_chat_id != chat_id) {
                            let options = {};
                            if (typeof msg.reply_to_message === "object") {
                                //console.log(user.reply_table);
                                //console.log(current_user.reply_table);
                                //console.log(msg.reply_to_message);
                                options.reply_to_message_id = getUserWrapperId(current_user,
                                    user.reply_table[msg.reply_to_message.message_id]
                                ) || user.reply_table[msg.reply_to_message.message_id] || getUserWrapperId(current_user,
                                    msg.reply_to_message.message_id);
                                if (!options.reply_to_message_id) delete options.reply_to_message_id;
                            }
                            Bot.sendMessage(user_chat_id, msg.text, options).then(r => {
                                //console.log("sent message:");
                                //console.log(r);
                                current_user.reply_table[r.message_id] = msg.message_id;
                            });
                        }
                    });
                }
            }
        } else {
            if (msg.text.startsWith("/start")) {
                Bot.sendMessage(chat_id, "Добро пожаловать в Мусорки*!\nЧтобы отписаться, напиши /unsub");
                Users.addUser(chat_id, {
                    timestamp: +Date.now(),
                    msg_count: 0,
                    reply_table: {},
                    user_data: msg.chat,
                    chat_id: chat_id,
                });
            } else {
                Bot.sendMessage(chat_id, "Вы либо не подписаны, либо отписались, либо прошло большое обновление.\nОтправьте /start чтобы подписаться");
            }
        }
    }
});