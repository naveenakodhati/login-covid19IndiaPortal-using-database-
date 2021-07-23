const express = require("express");
const app = express();
app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.messsage}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateMiddleware = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Secret_Key", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetails = `SELECT * FROM user WHERE username='${username}';`;
  const isUser = await db.get(getUserDetails);
  if (isUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePassword = await bcrypt.compare(password, isUser.password);
    if (comparePassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Secret_Key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const statesDataQuery = (requestData) => ({
  stateId: requestData.state_id,
  stateName: requestData.state_name,
  population: requestData.population,
});

const districtDataQuery = (requestData) => ({
  districtId: requestData.district_id,
  districtName: requestData.district_name,
  stateId: requestData.state_id,
  cases: requestData.cases,
  cured: requestData.cured,
  active: requestData.active,
  deaths: requestData.deaths,
});

app.get("/states", authenticateMiddleware, async (request, response) => {
  const getStates = `SELECT * FROM state;`;
  const states = await db.all(getStates);
  response.send(states.map((eachState) => statesDataQuery(eachState)));
});

app.get(
  "/states/:stateId",
  authenticateMiddleware,
  async (request, response) => {
    const { stateId } = request.params;
    const getEachState = `SELECT * FROM state
    WHERE state_id=${stateId} ;`;
    const eachState = await db.get(getEachState);
    response.send(statesDataQuery(eachState));
  }
);

app.post("/districts", authenticateMiddleware, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictData = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(createDistrictData);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId",
  authenticateMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictData = `SELECT * FROM district WHERE district_id=${districtId};`;
    const eachDistrict = await db.get(getDistrictData);
    response.send(districtDataQuery(eachDistrict));
  }
);

app.delete(
  "/districts/:districtId",
  authenticateMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId",
  authenticateMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictData = `UPDATE district SET 
     district_name='${districtName}',
     state_id =${stateId},
     cases=${cases},
     cured=${cured},
     active=${active},
     deaths =${deaths}
     WHERE district_id=${districtId};`;
    await db.run(updateDistrictData);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats",
  authenticateMiddleware,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalStateInfo = `SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths FROM district WHERE state_id=${stateId};`;
    const totalStateInfo = await db.get(getTotalStateInfo);
    response.send({
      totalCases: totalStateInfo.totalCases,
      totalCured: totalStateInfo.totalCured,
      totalActive: totalStateInfo.totalActive,
      totalDeaths: totalStateInfo.totalDeaths,
    });
  }
);
module.exports = app;
