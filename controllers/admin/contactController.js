const { ContactUs } = require("../../models");
const { Op } = require("sequelize");

exports.showContact = async (req, res) => {
  try {
    res.render("admin/contacts", {
      layout: "admin/layouts/index",
      title: "Contact Inquiries",
      error: null,
    });
    req.session.error = null;
  } catch (error) {
    console.error("Error in show Contact List", error);
  }
};

exports.getAllContacts = async (req, res) => {
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
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } }, 
            { email: { [Op.like]: `%${search}%` } }, 
            { subject: { [Op.like]: `%${search}%` } }, 
            { message: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};

    // fetch all User without limit and offset
    const allContact = await ContactUs.findAll({
      where,
      order: [[sortField, sortOrder]],
    });

    const { count, rows: contacts } = await ContactUs .findAndCountAll({
      where,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.json({
      items:contacts,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemCount: allContact.length,
    });
  } catch (error) {
    console.error("Error in fetch contact data", error);
    res.status(403).json({ message: "Internal Server Error." });
  }
};
