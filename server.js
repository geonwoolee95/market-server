const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const session = require("express-session");
const app = express();
const models = require("./models");
const multer = require("multer");
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  }),
});
const detectProduct = require("./helpers/detectProduct");
const port = process.env.PORT || 8080;

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated || false;
  res.locals.username = req.session.username || "";
  next();
});

app.get("/banners", (req, res) => {
  models.Banner.findAll({
    limit: 2,
  })
    .then((result) => {
      res.send({
        banners: result,
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("에러가 발생했습니다");
    });
});

async function hashPassword(password) {
  const saltRounds = 10; // 솔트를 사용한 라운드 수
  return await bcrypt.hash(password, saltRounds);
}

app.post("/signup", async (req, res) => {
  try {
    const body = req.body;
    const { username, name, email, password, passwordconfirm } = body;

    if (!username || !name || !email || !password || !passwordconfirm) {
      res.status(400).send("모든 필드를 입력해주세요");
      return;
    }

    const hashedPassword = await hashPassword(password);
    const result = await models.Member.create({
      username,
      name,
      email,
      password: hashedPassword,
    });

    console.log("회원가입 결과 : ", result);
    res.send({
      result,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send("회원가입에 문제가 발생하였습니다.");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await models.Member.findOne({
      where: {
        username: username,
      },
    });

    if (!user) {
      res.status(400).send("사용자를 찾을 수 없습니다.");
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.isAuthenticated = true;
      req.session.username = username;
      res.send("로그인 성공!");
    } else {
      res.status(400).send("비밀번호가 일치하지 않습니다.");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("로그인 중 에러가 발생했습니다.");
  }
});

app.get("/products", (req, res) => {
  models.Product.findAll({
    order: [["createdAt", "DESC"]],
    attributes: [
      "id",
      "name",
      "price",
      "createdAt",
      "seller",
      "imageUrl",
      "soldout",
    ],
  })
    .then((result) => {
      console.log("PRODUCTS : ", result);
      res.send({
        products: result,
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(400).send("에러 발생");
    });
});

app.post("/products", (req, res) => {
  const body = req.body;
  const { name, description, price, seller, imageUrl } = body;
  if (!name || !description || !price || !seller || !imageUrl) {
    res.status(400).send("모든 필드를 입력해주세요");
  }
  // 원래는 따로 빼서 한시간에 한번씩이나 그렇게 돌림 이렇게 하면 효율이 안좋음
  detectProduct(imageUrl, (type) => {
    models.Product.create({ description, price, seller, imageUrl, name, type })
      .then((result) => {
        console.log("상품 생성 결과 : ", result);
        res.send({
          result,
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(400).send("상품 업로드에 문제가 발생했습니다");
      });
  });
});

app.get("/products/:id", (req, res) => {
  const params = req.params;
  const { id } = params;
  models.Product.findOne({
    where: {
      id: id,
    },
  })
    .then((result) => {
      console.log("PRODUCT : ", result);
      res.send({
        product: result,
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(400).send("상품 조회에 에러가 발생했습니다");
    });
});

app.post("/image", upload.single("image"), (req, res) => {
  const file = req.file;
  console.log(file);
  res.send({
    imageUrl: file.path,
  });
});

app.post("/purchase/:id", (req, res) => {
  const { id } = req.params;
  models.Product.update(
    {
      soldout: 1,
    },
    {
      where: {
        id,
      },
    }
  )
    .then((result) => {
      res.send({
        result: true,
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("에러가 발생했습니다.");
    });
});
app.get("/products/:id/recommendation", (req, res) => {
  const { id } = req.params;
  models.Product.findOne({
    where: {
      id,
    },
  })
    .then((product) => {
      const type = product.type;
      models.Product.findAll({
        where: {
          type,
          id: {
            [models.Sequelize.Op.ne]: id,
          },
        },
      }).then((products) => {
        res.send({
          products,
        });
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("에러가 발생했습니다.");
    });
});

app.listen(port, () => {
  console.log("그랩의 쇼핑몰 서버가 돌아가고 있습니다");
  models.sequelize
    .sync()
    .then(() => {
      console.log("DB 연결 성공!");
    })
    .catch((err) => {
      console.error(err);
      console.log("DB 연결 에러ㅠ");
      process.exit();
    });
});
