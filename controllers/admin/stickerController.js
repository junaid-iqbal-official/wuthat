const { Sticker } = require("../../models");
const { Op } = require("sequelize");

exports.showSticker = async (req, res) => {
  res.render("admin/sticker/sticker-list", {
    layout: "admin/layouts/index",
    title: "Stickers",
    error: null,
  });
};

exports.getAllStickers = async (req, res) => {
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
          [Op.or]: [{ title: { [Op.like]: `%${search}%` } }],
        }
      : {};

    // fetch all list without limit and offset
    const stickerList = await Sticker.findAll({
      where,
      order: [[sortField, sortOrder]],
    });

    const { count, rows: stickers } = await Sticker.findAndCountAll({
      where,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.json({
      items: stickers,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      itemCount: stickerList.length,
    });
  } catch (error) {
    console.error("Error in fetch Sticker data", error);
    res.status(403).json({ message: "Internal Server Error." });
  }
};

exports.createSticker = async (req,res) => {
  try {
    const { title } = req.body;

    const existing = await Sticker.findOne({ where: { title } });
    if (existing) {
      return res.redirect('/admin/sticker');
    }

    if (!req.file) {
      return res.redirect('/admin/sticker');
    }

    const file = req.file;

    const filePath = `/uploads/${file.filename}`; // what you want in DB
    const metadata = {
      file_size: file.size,
      original_name: file.originalname,
      mime_type: file.mimetype,
      path: file.path
    };

    await Sticker.create({
      title,
      sticker: filePath,
      metadata,
      status: req.body.stickerStatus ? true : false
    });

    return res.redirect('/admin/sticker');

  } catch (error) {
    console.error("Error in create Sticker", error);
    res.redirect('/admin/sticker');
  }
}

exports.editSticker = async (req, res) => {
  try {
    const { title, stickerStatus, id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Sticker ID not provided" });
    }

    const sticker = await Sticker.findByPk(id);
    if (!sticker) {
      return res.status(404).json({ success: false, message: "Sticker not found" });
    }
    
    const updatedData = {
      title,
      status: stickerStatus ? true : false
    };

    if (req.file) {
      const file = req.file;

      // New file uploaded: update path and metadata
      updatedData.sticker = `/uploads/${file.filename}`;
      updatedData.metadata = {
        file_size: file.size,
        original_name: file.originalname,
        mime_type: file.mimetype,
        path: file.path,
      };

      // Optionally delete old file:
      fs.unlinkSync(sticker.sticker); 
    }

    await sticker.update(updatedData);

    return res.status(200).json({ success: true, sticker:sticker.toJSON() });

  } catch (error) {
    console.error("Error in editSticker controller:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};  

exports.deleteSticker = async(req,res) =>{
  const {id} = req.body;
  
  try {

    if(!id){
      return res.status(404).json({message:"Sticker Id is not provided",success:false});
    }

    const sticker = await Sticker.findByPk(id);
    if(!sticker){
      return res.status(404).json({message:"Sticker not found.",success:false});
    }

    await sticker.destroy();
    return res.status(201).json({success:true});
  } catch (error) {
    console.error("Error in delete Sticker data", error);
    return res.status(404).json({message:"Internal Server Error.",success:false});
  }
}

exports.updateStatus = async (req,res) =>{
  const {id,status} = req.body;

  try {

    if(!id){
      return res.status(404).json({message:"Sticker Id is not provided",success:false});
    }

    const sticker = await Sticker.findByPk(id);
    if(!sticker){
      return res.status(404).json({message:"Sticker not found.",success:false});
    }

    await sticker.update({status:status ? false :true})
    return res.status(201).json({success:true});
    
  } catch (error) {
    console.error("Error in update Sticker status", error);
    return res.status(404).json({message:"Internal Server Error.",success:false});
  }
  
}