
import path from "path";
import vue from "rollup-plugin-vue";
import commonjs from "rollup-plugin-commonjs";
import replace from "rollup-plugin-replace";
import alias from "rollup-plugin-alias";



export default [{
	input: "./front-end/index.js",

	output: {
		format: "iife",
		file: path.posix.join("dist", "index.bundle.js"),
	},

	plugins: [
		replace({
			"process.env.NODE_ENV": JSON.stringify("development"),
			"process.env.VUE_ENV": JSON.stringify("browser"),
		}),
		commonjs(),
		vue(),
		alias({
			vue: require.resolve("vue/dist/vue.esm.js"),
		}),
	],
}];