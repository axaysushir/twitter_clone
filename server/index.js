const express = require("express");
const app = express();
const cors = require("cors");
const monk = require("monk");
const Filter = require("bad-words");
const rateLimit = require("express-rate-limit");

// This will talk to database mongoDB
const db = monk(process.env.MONGO_URI || "localhost/meower");
const mews = db.get("mews");

const filter = new Filter(); // bad words

app.enable('trust-proxy');

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Hello Dora.. 😸😹"
  });
});

//Get adll mews form database
app.get("/mews", (req, res, next) => {
  mews
    .find()
    .then(mews => {
      res.json(mews);
    })
    .catch(next);
});

// second part of app making a pagination to scroll infinite tweets

app.get("/v2/mews", (req, res, next) => {
  // set limit=10 & skip=0       low of triviality oro bike shedding
  // let skip = Number(req.query.skip) || 0; // if parse without number then gives error that query should be numeric value
  // let limit = Number(req.query.limit) || 10; // so that wrap this  query with number

  let { skip = 0, limit = 5, sort='desc' } = req.query;
  skip = parseInt(skip) || 0;
  limit = parseInt(limit) || 5;

  skip = skip < 0 ? 0 : skip;
  limit = Math.min(50, Math.max(1, limit));

  Promise.all([
    mews.count(),
    mews.find(
      {},
      {
        skip,
        limit,
        sort: {
            created: sort === 'desc' ? -1 : 1 // 51: 03
        }
      }
    )
  ])
    .then(([ total, mews ]) => {
      res.json({
        mews,
        pagination: {
          total,
          skip,
          limit,
          remaining: total - (skip + limit) > 0
        }
      });
    })
    .catch(next);
});

// first backend mew validation for name & content
function isValidMew(mew) {
  return (
    mew.name &&
    mew.name.toString().trim() !== "" && mew.name.toString().trim().length <= 50 &&
    mew.content &&
    mew.content.toString().trim() !== "" && mew.content.toString().trim().length <= 140
  );
}

// limit request to server with this limiter
app.use(
  rateLimit({
    windowMs: 30 * 1000, // every 30 seconds
    max: 1 // limit each IP to 100 requests per windowMs
  })
);

const createMew = (req, res, next) => {
  if (isValidMew(req.body)) {
    // insert into db & also filter bad words and code injection
    const mew = {
      name: filter.clean(req.body.name.toString().trim()),
      content: filter.clean(req.body.content.toString().trim()),
      created: new Date()
    };

    mews.insert(mew).then(createdMew => {
      res.json(createdMew);
    }).catch(next);
  } else {
    res.status(422);
    res.json({
      message: "Hey! Name & content are required."
    });
  }
}


// validate name & content if not then send error status code
app.post("/mews", createMew);
app.post("/v2/mews", createMew);

// send error message
app.use((error, req, res, next) => {
  res.status(500);
  res.json({
    message: error.message
  });
});

app.listen(5000, () => {
  console.log("Server started on http:localhost:5000");
});
