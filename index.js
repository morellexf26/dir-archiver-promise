"use strict";

const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

class DirArchiver {
  /**
   * The constructor.
   * @param {string} directoryPath - the path of the folder to archive.
   * @param {string} zipPath - The path of the zip file to create.
   * @param {Boolean} includeBaseDirectory - Includes a base directory at the root of the archive. For example, if the root folder of your project is named "your-project", setting includeBaseDirectory to true will create an archive that includes this base directory. If this option is set to false the archive created will unzip its content to the current directory.
   * @param {array} excludes - The name of the files and foldes to exclude.
   */
  constructor(directoryPath, zipPath, includeBaseDirectory, excludes) {
    // Contains the excluded files and folders.
    this.excludes = excludes.map((element) => {
      return path.normalize(element);
    });

    this.directoryPath = path.resolve(directoryPath);

    this.zipPath = path.resolve(zipPath);

    this.includeBaseDirectory = includeBaseDirectory;

    this.baseDirectory = path.basename(this.directoryPath);
  }

  /**
   * Recursively traverse the directory tree and append the files to the archive.
   * @param {string} directoryPath - The path of the directory being looped through.
   */
  traverseDirectoryTree(directoryPath) {
    const files = fs.readdirSync(directoryPath);
    for (const i in files) {
      const currentPath = path.join(path.resolve(directoryPath), files[i]);
      const stats = fs.statSync(currentPath);
      let relativePath = path.relative(this.directoryPath, currentPath);
      if (stats.isFile() && !this.excludes.includes(relativePath)) {
        if (this.includeBaseDirectory === true) {
          this.archive.file(currentPath, {
            name: path.join(this.baseDirectory, relativePath)
          });
        } else {
          this.archive.file(currentPath, {
            name: relativePath
          });
        }
      } else if (stats.isDirectory() && !this.excludes.includes(relativePath)) {
        this.traverseDirectoryTree(currentPath);
      }
    }
  }

  prettyBytes(bytes) {
    if (bytes > 1000 && bytes < 1000000) {
      return Math.round((bytes / 1000 + Number.EPSILON) * 100) / 100 + " KB";
    }
    if (bytes > 1000000 && bytes < 1000000000) {
      return Math.round((bytes / 1000000 + Number.EPSILON) * 100) / 100 + " MB";
    }
    if (bytes > 1000000000) {
      return Math.round((bytes / 1000000000 + Number.EPSILON) * 100) / 100 + " GB";
    }
    return bytes + " bytes";
  }

  createZip() {
    // Remove the destination zip if it exists.
    // see : https://github.com/Ismail-elkorchi/dir-archiver/issues/5
    return new Promise((resolve, reject) => {
      if (fs.existsSync(this.zipPath)) {
        fs.unlinkSync(this.zipPath);
      }
      // Create a file to stream archive data to.
      this.output = fs.createWriteStream(this.zipPath);
      this.archive = archiver("zip", {
        zlib: { level: 9 }
      });

      // Catch warnings during archiving.
      this.archive.on("warning", function (err) {
        if (err.code === "ENOENT") {
          // log warning
          console.log(err);
        } else {
          reject(err);
        }
      });

      // Catch errors during archiving.
      this.archive.on("error", function (err) {
        reject(err);
      });

      // Pipe archive data to the file.
      this.archive.pipe(this.output);

      // Recursively traverse the directory tree and append the files to the archive.
      this.traverseDirectoryTree(this.directoryPath);

      // Finalize the archive.
      this.archive.finalize();

      const self = this;
      // Listen for all archive data to be written.
      this.output.on("close", function () {
        console.log(`Created ${self.zipPath} of ${self.prettyBytes(self.archive.pointer())}`);
		resolve();
      });
    });
  }
}
module.exports = DirArchiver;
