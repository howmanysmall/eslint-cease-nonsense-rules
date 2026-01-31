import { createConsola } from "consola";
import applicationPaths from "../constants/application-paths";
import createDailyFileRotateReporter from "./reports/create-daily-file-rotate-reporter";

const errorReporter = createDailyFileRotateReporter({
	directory: applicationPaths.log,
	filename: "error.log",
	levelFilter: (level) => level <= 1,
});

const combinedReporter = createDailyFileRotateReporter({
	directory: applicationPaths.log,
	filename: "combined.log",
});

const log = createConsola({
	formatOptions: {
		colors: true,
		compact: false,
		date: true,
	},
	reporters: [errorReporter, combinedReporter],
});

export default log;
