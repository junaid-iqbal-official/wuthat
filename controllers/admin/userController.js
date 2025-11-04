const { User, UserSettings } = require("../../models");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

exports.showUser = async (req, res) => {
  try {
    res.render("admin/users/user-list", {
      layout: "admin/layouts/index",
      title: "Users",
      error: null,
    });
    req.session.error = null;
  } catch (error) {
    console.error("Error in show users", error);
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search || decodeURIComponent(req.query.search || '');
    const sortField = req.query.sortField || "id";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
    
    // where condition based on search parameter
    const where = search
      ? {
          role: {
            [Op.ne]: "admin",
          },
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } }, 
            { email: { [Op.like]: `%${search}%` } }, 
            { phone: { [Op.like]: `%${search}%` } }, 
            { country: { [Op.like]: `%${search}%` } },
          ],
        }
      : {
          role: {
            [Op.ne]: "admin",
          },
        };

    // fetch all User without limit and offset
    const allUser = await User.findAll({
      where,
      order: [[sortField, sortOrder]],
    });

    const { count, rows: users } = await User.findAndCountAll({
      where,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.json({
      items:users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemCount: allUser.length,
    });
  } catch (error) {
    console.error("Error in fetch user data", error);
    res.status(403).json({ message: "Internal Server Error." });
  }
};

exports.createUser = async (req, res) => {
  const { name, email, password, role, username } = req.body;
  let status;

  try {
    if(req.body.status){
      status = 'active';
    }else{
      status = 'deactive';      
    }

    if (!username) {
      req.session.error = "User Name is not provided";
      return res.redirect("/admin/user");
    }

    const existing = await User.findOne({ where: { email, role: role } });
    if (existing) {
      req.session.error = "Email already registered.";
      return res.redirect("/admin/user");
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({username, name, email, password: hashed, role, status });
    await UserSettings.create({user_id:user.id});
    
    res.redirect("/admin/user");
  } catch (error) {
    console.error("Error in create user", error);

    req.session.error = "Internal Server Error";
    return res.redirect("/admin/user");
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.body;

  try {
    if (!id) {
      return res.status(403).json({message:"User Id Not Provided."});
    }

    const existing = await User.findByPk(id);
    if (!existing) {
      return res.status(404).json({message:"User not Found."});
    }

    await existing.destroy();
    
    return res.status(201).json({success:true});
  } catch (error) {
    console.error("Error in delete user", error);
    return res.status(500).json({message: 'Internal Server Error.'});
  }
};

exports.editUser = async (req, res) => {
  const { name,username, email, phone, role, id, status } = req.body;

  try {

    if (!id) {
      return res.status(403).json({message:"User Id Not Provided."});
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({message:"User not Found."});
    }

    if (email !== user.email) {
      const existing = await User.findOne({ where: { email, role } });
      if (existing) {
        return res.status(403).json({message:"Email is already exists.."});
      }
    }

    await user.update({username, name, email, phone, role, status: status ? "active" : "deactive" });

    return res.status(201).json({success:true,user:user.toJSON()});
  } catch (error) {
    console.error("Error in Edit user", error);
    return res.status(500).json({message: 'Internal Server Error.'});
  }
};

exports.updateStatus = async (req, res) => {
  const { id, status } = req.body;
  let updated;
  
  try {
    if (status === "active") {
      updated = 'deactive'
     await User.update({ status: "deactive" }, { where: { id },raw:true });
    } else {
      updated = 'active'
     await User.update({ status: "active" }, { where: { id },raw:true });
    }
    return res.status(201).json({message:"success",id:id,status:updated});
  } catch (error) {
    console.error("Error in Edit user status", error);

    return res.status(500).json({message: 'Internal Server Error.'});
  }
};
