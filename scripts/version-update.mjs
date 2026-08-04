import fs from "fs";

const version = process.argv[2];

if (!version) {
	console.error("Usage: node scripts/update-version.mjs <version>");
	process.exit(1);
}

function updateJsonFile(path, updater) {
	const data = JSON.parse(fs.readFileSync(path, "utf8"));
	updater(data);

	fs.writeFileSync(
		path,
		JSON.stringify(data, null, 2) + "\n"
	);
}

// Update manifest.json
updateJsonFile("manifest.json", (manifest) => {
	manifest.version = version;
});

// Update package.json
updateJsonFile("package.json", (pkg) => {
	pkg.version = version;
});

// Update versions.json
updateJsonFile("versions.json", (versions) => {
	const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
	versions[version] = manifest.minAppVersion;
});

console.log(`Updated version files to ${version}`);