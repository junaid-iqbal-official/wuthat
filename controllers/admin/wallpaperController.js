const { ChatWallpaper } = require("../../models");
const { Op } = require("sequelize");

exports.showWallpaper = async (req, res) => {
  res.render("admin/wallpaper/wallpaper-list", {
    layout: "admin/layouts/index",
    title: "Chat Wallpapers",
    error: null,
  });
};

exports.getAllWallpapers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search || "";
    const sortField = req.query.sortField || "id";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

    // where condition based on search parameter
    const where = search
      ? {
          [Op.or]: [{ Name: { [Op.like]: `%${search}%` } }],
        }
      : {};

    // fetch all list without limit and offset
    const wallpaperList = await ChatWallpaper.findAll({
      where,
      order: [[sortField, sortOrder]],
    });

    const { count, rows: wallpapers } = await ChatWallpaper.findAndCountAll({
      where,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.json({
      items: wallpapers,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemCount: wallpaperList.length,
    });
  } catch (error) {
    console.error("Error in fetch wallpaper data", error);
    res.status(403).json({ message: "Internal Server Error." });
  }
};

exports.createWallpaper = async (req,res) => {
  try {
    const { name } = req.body;

    if (!req.file) {
      return res.redirect('/admin/wallpaper');
    }

    const file = req.file;

    const filePath = `/uploads/${file.filename}`; // what you want in DB
    const metadata = {
      file_size: file.size,
      original_name: file.originalname,
      mime_type: file.mimetype,
      path: file.path
    };

    await ChatWallpaper.create({
      name,
      wallpaper: filePath,
      metadata,
      isActive: req.body.isActive ? true : false,
    });

    return res.redirect('/admin/wallpaper');

  } catch (error) {
    console.error("Error in create Sticker", error);
    res.redirect('/admin/sticker');
  }
}

exports.editWallpaper = async (req,res) => {
  const { name, id } = req.body;
  const isActive = req.body['is_active'] ? true : false;
  const isDefault = req.body['is_default'] ? true : false;

  try {
    if (!id) {
      return res.status(400).json({ success: false, message: "Wallpaper ID is required." });
    }

    const wallpaper = await ChatWallpaper.findByPk(id);
    if (!wallpaper) {
      return res.status(404).json({ success: false, message: "Wallpaper not found." });
    }

    const updateData = {
      name,
      isActive,
    };

    // If file is uploaded, update wallpaper and metadata
    if (req.file) {
      const file = req.file;
      updateData.wallpaper = `/uploads/${file.filename}`;
      updateData.metadata = {
        file_size: file.size,
        original_name: file.originalname,
        mime_type: file.mimetype,
        path: file.path
      };
    }

    await wallpaper.update(updateData);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in editWallpaper:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

exports.deleteWallpaper = async (req, res) => {
  const { id } = req.body;

  try {
    if (!id) {
      return res.status(403).json({ message: "wallpaper Id Not Provided." });
    }

    const existing = await ChatWallpaper.findByPk(id);
    if (!existing) {
      return res.status(404).json({ message: "Wallpaper not Found." });
    }

    await existing.destroy();

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error in delete wallpaper", error);
    return res.status(500).json({ message: "Internal Server Error." });
  }
};

exports.updateStatus = async (req, res) => {
  const { id, status } = req.body;
  const field = req.query.field;

  try {
    if (!id) {
      return res.status(404).json({ message: "wallpaper Id is not provided", success: false });
    }

    if (!["is_active", "is_default"].includes(field)) {
      return res.status(404).json({ message: "Invalid Field", success: false });
    }

    const wallpaper = await ChatWallpaper.findByPk(id);
    if (!wallpaper) {
      return res.status(404).json({ message: "Wallpaper not found.", success: false });
    }

    await wallpaper.update({ [field]: status ? false : true });
    return res.status(201).json({ message: "Updated Successfully", success: true });
  } catch (error) {
    console.error("Error in update wallpaper status", error);
    return res.status(404).json({ message: "Internal Server Error.", success: false });
  }
};
