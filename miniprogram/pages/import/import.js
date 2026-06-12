Page({
  data: {
    fileName: "",
    fileID: "",
    cloudPath: "",
    importing: false,
    result: null,
  },

  isSupportedExcel(fileName = "") {
    return /\.(xlsx|xls)$/i.test(fileName);
  },

  normalizeImportError(err) {
    const rawMsg = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : String(err || "");
    const lowerMsg = rawMsg.toLowerCase();

    if (
      lowerMsg.includes("corrupted zip") ||
      lowerMsg.includes("end of central directory") ||
      lowerMsg.includes("invalid zip")
    ) {
      return "Excel文件不完整或已损坏，请重新导出后再导入";
    }
    if (lowerMsg.includes("functions_time_limit_exceeded") || lowerMsg.includes("timed out")) {
      return "导入超时，请稍后重试（已改为分批导入，通常重试即可）";
    }
    return rawMsg || "导入失败，请重试";
  },

  isTimeoutError(err) {
    const rawMsg = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : String(err || "");
    const lowerMsg = rawMsg.toLowerCase();
    return lowerMsg.includes("functions_time_limit_exceeded") || lowerMsg.includes("timed out");
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["xlsx", "xls"],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;

        if (!this.isSupportedExcel(file.name)) {
          wx.showToast({ title: "请选择xlsx/xls文件", icon: "none" });
          return;
        }
        if (!file.size || file.size <= 0) {
          wx.showToast({ title: "文件为空，请重新选择", icon: "none" });
          return;
        }

        const ext = file.name.match(/\.[^.]+$/)?.[0] || ".xlsx";
        const cloudPath = `imports/${Date.now()}${ext}`;
        this.setData({ fileName: file.name, fileID: "", cloudPath, result: null });
        wx.showLoading({ title: "上传中..." });

        wx.cloud.uploadFile({
          cloudPath,
          filePath: file.path,
          success: async (uploadRes) => {
            wx.hideLoading();
            this.setData({ fileID: uploadRes.fileID });
            try {
              await wx.cloud.callFunction({
                name: "importApplications",
                data: {
                  action: "register",
                  fileID: uploadRes.fileID,
                  fileName: file.name,
                  cloudPath,
                },
              });
            } catch (e) {}
            wx.showToast({ title: "文件已就绪", icon: "success" });
          },
          fail: (uploadErr) => {
            wx.hideLoading();
            wx.showModal({
              title: "上传失败",
              content: this.normalizeImportError(uploadErr),
              showCancel: false,
            });
          },
        });
      },
    });
  },

  async startImport() {
    if (!this.data.fileID) {
      wx.showToast({ title: "请先选择文件", icon: "none" });
      return;
    }

    this.setData({ importing: true, result: null });

    const batchLimit = 5;
    let offset = 0;
    let total = 0;
    let totalSuccess = 0;
    let totalFail = 0;

    try {
      while (true) {
        wx.showLoading({
          title: total > 0 ? `导入中 ${Math.min(offset, total)}/${total}` : "正在导入...",
          mask: true,
        });

        let res = null;
        let retry = 0;
        const maxRetry = 3;
        while (retry <= maxRetry) {
          try {
            res = await wx.cloud.callFunction({
              name: "importApplications",
              data: {
                fileID: this.data.fileID,
                fileName: this.data.fileName,
                cloudPath: this.data.cloudPath,
                offset,
                limit: batchLimit,
              },
            });
            break;
          } catch (callErr) {
            if (!this.isTimeoutError(callErr) || retry === maxRetry) {
              throw callErr;
            }
            retry += 1;
            await new Promise((resolve) => setTimeout(resolve, 500 * retry));
          }
        }

        const result = res.result || {};
        if (!result.success) {
          throw new Error(result.message || "导入失败");
        }

        total = result.total || total;
        totalSuccess += Number(result.successCount || 0);
        totalFail += Number(result.failCount || 0);
        offset = Number(result.nextOffset || offset);

        if (result.done) break;
      }

      wx.hideLoading();
      this.setData({
        importing: false,
        result: {
          success: true,
          total,
          successCount: totalSuccess,
          failCount: totalFail,
          message: `导入完成：成功 ${totalSuccess} 条，失败 ${totalFail} 条`,
        },
      });

      wx.showModal({
        title: "导入完成",
        content: `总计 ${total} 条\n成功 ${totalSuccess} 条\n失败 ${totalFail} 条`,
        showCancel: false,
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ importing: false });
      wx.showModal({
        title: "导入失败",
        content: this.normalizeImportError(err),
        showCancel: false,
      });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
