const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

// load dotenv to read environment variables
require("dotenv").config();

// template view engine
app.set("view engine", "ejs");

// Serve Static Files
app.use(express.static("public"));

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

function checkAuth(req, res, next) {
  if (!req.cookies.token) return res.redirect("/login");

  jwt.verify(req.cookies.token, process.env.JWT_SECRET, function (err, decoded) {
    if (err) {
      res.redirect("/login");
    } else {
      next();
    }
  });
}

app.get("/mqttConnDetails", (req, res) => {
  if (!req.cookies.token) return res.status(403);

  jwt.verify(req.cookies.token, process.env.JWT_SECRET, function (err, decoded) {
    if (err) {
      res.status(403);
    } else {
      res.send(
        JSON.stringify({
          mqttServer: process.env.MQTT_BROKER,
          mqttUsername: process.env.MQTT_USERNAME,
          mqttPassword: process.env.MQTT_PASSWORD,
        })
      );
    }

  });
});

app.get("/", checkAuth, function (req, res) {
  res.redirect("/dashboard");
});

app.get("/dashboard", checkAuth, function (req, res) {
  res.render("dashboard", {
    title: "Dashboard",
  });
});

app.get("/login", function (req, res) {
  res.render("login", {
    title: "Login",
  });
});

app.post("/login", function (req, res) {
  if (!req.body.username || !req.body.password) {
    return res.redirect("/");
  }
  const username = req.body.username;
  const password = req.body.password;

  if (username === process.env.MQTT_USERNAME && password === process.env.MQTT_PASSWORD) {
    const token = jwt.sign({ username: username }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("token", token, { httpOnly: true });
  } else {
  }
  res.redirect("/");
});

app.listen(process.env.APP_PORT);