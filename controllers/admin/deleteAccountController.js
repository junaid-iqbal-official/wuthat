const { UserSettings,User } = require("../../models");
const { Op } = require("sequelize");

exports.showDeleteAccount = async (req, res) => {
  try {
    res.render("admin/deleted-accounts", {
      layout: "admin/layouts/index",
      title: "Deleted Accounts",
      error: null,
    });
    req.session.error = null;
  } catch (error) {
    console.error("Error in show deleted account List", error);
  }
};

exports.deletedAccounts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search || decodeURIComponent(req.query.search || '');
    const sortField = req.query.sortField || "id";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
    
    const order = [];
    if (sortField === 'name' || sortField === 'email') {
      order.push([{ model: User, as: 'User' }, sortField, sortOrder]);
    } else {
      order.push([sortField, sortOrder]);
    } 

    // where condition based on search parameter
    const whereUser = search
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } }, 
            { email: { [Op.like]: `%${search}%` } }, 
          ],
        }
      : {};

    // Only fetch users with delete_requested = 'pending' or 'approved'
    const settingsWhere = {
        delete_requested: {
          [Op.in]: ['pending', 'approved']
        }
      };

    // fetch all User without limit and offset
    const allData = await UserSettings.findAll({
        where: settingsWhere,
        include: [
            {
              model: User,
              as: 'User', 
              where: whereUser,
              attributes: ['id', 'name', 'email'],
              paranoid: false
            }
        ],
        order: order
    });
    
    const { count, rows: settings } = await UserSettings.findAndCountAll({
        where: settingsWhere,
        include: [
            {
              model: User,
              as: 'User', 
              where: whereUser,
              attributes: ['id', 'name', 'email'],
              paranoid: false
            }
        ],
        order: order,
        limit,
        offset
    });
    
    const data = settings.map((setting, index) => ({
        serial: offset + index + 1,
        name: setting.User.name,
        email: setting.User.email,
        status: setting.delete_requested,
        requestedAt: setting.metadata?.delete_requested_at || setting.updated_at
    }));

    res.json({
      items:data,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemCount: allData.length,
    });
  } catch (error) {
    console.error("Error in fetch contact data", error);
    res.status(403).json({ message: "Internal Server Error." });
  }
};