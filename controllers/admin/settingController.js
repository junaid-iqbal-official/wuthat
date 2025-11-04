const { Setting } = require("../../models");
const LOGO_KEYS = {
  favicon_logo: 'Favicon Logo',
  app_logo: 'App Logo',
  dark_logo: 'Dark Logo',
  big_logo: 'Big Logo',
  white_logo: 'White Logo'
};

exports.editSettingControl = async (req, res) => {
  const redirectPage = req.params.id;
  const settingsToUpdate = req.body;
  const files = req.files;
  let updatedValues;

  try {
    await Promise.all(
      Object.entries(settingsToUpdate).map(([key, value]) => {
        if (typeof value === "object") {
          updatedValues = value.toString();
        } else {
          updatedValues = value;
        }

        Setting.update({ value: updatedValues }, { where: { key } });
      })
    );

    // Process uploaded logo files (if any)
    for (const key in LOGO_KEYS) {
      const fileField = `${key}_file`;
      const label = LOGO_KEYS[key];

      const file = files?.[fileField]?.[0];

      if (file) {
        const relativePath = `/uploads/${file.filename}`;

        const metadata = {
          originalName: file.originalname,
          mimeType: file.mimetype,
          label,
          storedPath: relativePath
        };

        // Upsert the setting
        await Setting.upsert({
          key,
          value: relativePath,
          label,
          type: 'image',
          category: 'frontend',
          metadata
        });
      }
    }

    if (redirectPage === "general") {
      return res.redirect("/admin/setting/general");
    } else if (redirectPage === "email") {
      return res.redirect("/admin/setting/email");
    } else if (redirectPage === "front") {
      return res.redirect("/admin/setting/frontend");
    } else if (redirectPage === "media") {
      return res.redirect("/admin/setting/media");
    }else if (redirectPage === "user") {
      return res.redirect("/admin/setting/control");
    }

  } catch (error) {
    console.error("Error in edit group Member Limit", error);

    req.session.error = "Internal Server Error";
    res.redirect(`/admin/setting/${redirectPage}`);
  }
};

exports.toggleSetting = async (req, res) => {
  const { settingKey, currentStatus } = req.body;

  if (!settingKey) {
    return res.status(400).json({ success: false, message: "Missing setting key" });
  }

  try {
    const newValue = currentStatus ? "false" : "true";

    await Setting.update({ value: newValue }, { where: { key: settingKey } });

    return res.status(201).json({ success: true, newValue });
  } catch (error) {
    console.error("Error in Toggle Setting", error);
    return res.status(201).json({ success: true, message: "Internal Server Error" });
  }
};

// ===== General Settings ===== //

exports.showGeneralSetting = async (req, res) => {
  const setting = await Setting.findAll({ where: { category: "general" }, raw: true });
  
  const settingMap = new Map();
  const toggleSettingMap = new Map();
  const supportFormatMap = new Map();
  const error = null;

  try {
    setting.forEach((item) => {
      if (item.type !== "BOOLEAN" && item.type !== "JSON") {
        settingMap.set(item.key, { value: item.value, label: item.label, is_array: false });
      } else if (item.type === "BOOLEAN") {
        toggleSettingMap.set(item.key, { value: item.value, label: item.label });
      } else if (item.type == "JSON") {
        const values = item.value.split(",");
        settingMap.set(item.key, { value: values, label: item.label, is_array: true });
      }
    });

    res.render("admin/setting/general", {
      layout: "admin/layouts/index",
      title: "General Settings",
      settingMap,
      supportFormatMap,
      toggleSettingMap,
      error: error,
    });
  } catch (error) {
    console.error("Error in show General Setting", error);
    return res.redirect("/admin/setting");
  }
};

// ======= E-mail Configuration Setting ======= //

exports.showEmailSetting = async (req, res) => {
  const emailSetting = await Setting.findAll({ where: { category: "email" }, raw: true });
  const emailSettingMap = new Map();
  let values;

  try {
    emailSetting.forEach((item) => {
      if (item.type === "JSON") {
        values = item.value.split(",");
      } else {
        values = item.value;
      }
      emailSettingMap.set(item.key, { value: values, label: item.label });
    });

    res.render("admin/setting/email-config", {
      layout: "admin/layouts/index",
      title: "E-mail Configuration",
      emailSettingMap,
      error: null,
    });
  } catch (error) {
    console.error("Error in show E-mail Setting", error);
    return res.redirect("/admin/setting/email");
  }
};

// ===== Frontend Settings ===== //

exports.showFrontendSetting = async (req, res) => {
  const frontSetting = await Setting.findAll({ where: { category: "frontend" }, raw: true });
  const frontSettingMap = new Map();

  try {
    frontSetting.forEach((item) => {
      frontSettingMap.set(item.key, { value: item.value, label: item.label });
    });

    res.render("admin/setting/front-setting", {
      layout: "admin/layouts/index",
      title: "Frontend Settings",
      frontSettingMap,
      error: null,
    });
  } catch (error) {
    console.error("Error in show E-mail Setting", error);
    return res.redirect("/admin/setting/email");
  }
};

// ===== Media Settings ====== //

exports.showMediaSetting = async (req, res) => {
  const mediaSetting = await Setting.findAll({ where: { category: "media" }, raw: true });
  const mediaSettingMap = new Map();

  try {
    mediaSetting.forEach((item) => {
      if (item.type === "JSON") {
        const values = item.value.split(",");
        mediaSettingMap.set(item.key, { value: values, label: item.label, is_array: true });
      } else if(item.type === 'BOOLEAN') {
        mediaSettingMap.set(item.key, { value: item.value, label: item.label, is_boolean: true });
      }else{
        mediaSettingMap.set(item.key, { value: item.value, label: item.label, is_default:true });
      }
    });

    res.render("admin/setting/media-setting", {
      layout: "admin/layouts/index",
      title: "Media Settings",
      mediaSettingMap,
      error: null,
    });
  } catch (error) {
    console.error("Error in show Media Setting", error);
    return res.redirect("/admin/setting/email");
  }
};

// ===== User-control Setting ===== //
exports.showUserControlSetting = async(req,res) =>{
  const userSetting = await Setting.findAll({ where: { category: "user-control" }, raw: true });
  const userSettingMap = new Map();

  try {
    userSetting.forEach((item) => {
      if (item.type === "JSON") {
        const values = item.value.split(",");
        userSettingMap.set(item.key, { value: values, label: item.label, is_array: true });
      } else if(item.type === 'BOOLEAN') {
        userSettingMap.set(item.key, { value: item.value, label: item.label, is_boolean: true });
      }else{
        userSettingMap.set(item.key, { value: item.value, label: item.label, is_default:true });
      }
    });

    res.render("admin/setting/user-control", {
      layout: "admin/layouts/index",
      title: "User Controls",
      userSettingMap,
      error: null,
    });
  } catch (error) {
    console.error("Error in show Media Setting", error);
    return res.redirect("/admin/setting/email");
  }
}
