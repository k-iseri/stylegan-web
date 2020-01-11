<template>
	<div class="merger" @copy.prevent="onCopy">
		<aside>
			<StoreInput v-show="false" v-model="leftCode" sessionKey="mergerLeftCode" />
			<StoreInput v-show="false" v-model="rightCode" sessionKey="mergerRightCode" />
			<p>
				<GView class="g-view" :layers="latentLayers" :lastDimension="latentDimension" :latents.sync="sourceLatents[0]" @change="updateResultLatents" :ppLatentsBytes.sync="leftCode" />
				<GView class="g-view" :layers="latentLayers" :lastDimension="latentDimension" :latents.sync="sourceLatents[1]" @change="updateResultLatents" :ppLatentsBytes.sync="rightCode" />
			</p>
			<table class="turner">
				<tbody>
					<tr class="aggregation">
						<td class="chosen">
							<input type="checkbox" :class="{[`status-${aggregationStatus}`]: true}" :checked="aggregationStatus === 'ALL'" @change="onAggregationChosen" />
						</td>
						<td class="index">
							{{aggregationStatus}}
						</td>
						<td class="slider">
							<input type="range" v-model.number="aggregationBarValue" :min="-1" :max="1" step="any" :disabled="!Number.isFinite(aggregationBarValue)" />
						</td>
						<td class="value">
							{{Number.isFinite(aggregationBarValue) ? aggregationBarValue.toFixed(2) : null}}
						</td>
					</tr>
					<tr v-for="bar of bars" :key="bar.index">
						<td class="chosen">
							<input type="checkbox" v-model="bar.chosen" />
						</td>
						<td class="index">
							{{bar.index + 1}}.
						</td>
						<td class="slider">
							<input type="range" v-model.number="bar.value" :min="-1" :max="1" step="any" @change="updateResultLatentsLayer(bar.index)" />
						</td>
						<td class="value">
							{{bar.value.toFixed(2)}}
						</td>
					</tr>
				</tbody>
			</table>
		</aside>
		<main :class="{loading: resultLoading}">
			<img v-if="resultImageURL" class="result" :src="resultImageURL" @load="resultLoading = false" />
		</main>
		<div v-show="initializing" class="initializing">Model initializing, wait a moment...</div>
		<Navigator />
	</div>
</template>

<script>
	import Vue from "vue";

	import GView from "./g-view.vue";
	import StoreInput from "./storeinput.vue";
	import Navigator from "./navigator.vue";

	import * as LatentCode from "./latentCode.js"



	export default {
		name: "merger",


		components: {
			GView,
			StoreInput,
			Navigator,
		},


		data () {
			return {
				spec: null,
				initializing: false,
				bars: [],
				sourceLatents: [null, null],
				resultLatents: null,
				cachedResultCode: null,
				resultUpdateTime: 0,
				leftCode: null,
				rightCode: null,
				resultLoading: false,
			};
		},


		computed: {
			latentLayers () {
				return this.spec ? this.spec.synthesis_input_shape[1] : 0;
			},


			latentDimension () {
				return this.spec ? this.spec.synthesis_input_shape[2] : 512;
			},


			resultLatentsBytes () {
				return this.resultLatents && LatentCode.encodeFixed16(this.resultLatents);
			},


			resultImageURL () {
				return this.cachedResultCode && `/generate?fromW=1&xlatents=${encodeURIComponent(this.cachedResultCode)}`;
			},


			aggregationStatus () {
				const chosenBars = this.bars.filter(bar => bar.chosen);
				if (chosenBars.length === this.latentLayers)
					return "ALL";

				if (chosenBars.length)
					return "PART";

				return "NONE";
			},


			aggregationBarValue: {
				get () {
					const chosenBars = this.bars.filter(bar => bar.chosen);
					if (!chosenBars.length)
						return null;

					return chosenBars.reduce((sum, bar) => sum + bar.value, 0) / chosenBars.length;
				},

				set (value) {
					this.bars.filter(bar => bar.chosen).forEach(bar => {
						bar.value = value;
						this.updateResultLatentsLayer(bar.index);
					});
				},
			},
		},


		async created () {
			window.$main = this;

			this.initializing = true;

			const res = await fetch("/spec");
			this.spec = await res.json();
			console.log("model spec:", this.spec);

			this.resultLatents = Array(this.spec.synthesis_input_shape[1] * this.spec.synthesis_input_shape[2]).fill(0);

			this.initializing = false;
		},


		methods: {
			updateResultLatentsLayer (layer) {
				if (!this.resultLatents || !this.sourceLatents[0] || !this.sourceLatents[1])
					return;

				const k = this.bars[layer].value;
				for (let i = 0; i < this.latentDimension; ++i) {
					const index = layer * this.latentDimension + i;
					//this.resultLatents[index] = (this.sourceLatents[0][index] * (1 - k) + this.sourceLatents[1][index] * (k + 1)) / 2;
					Vue.set(this.resultLatents, index, (this.sourceLatents[0][index] * (1 - k) + this.sourceLatents[1][index] * (k + 1)) / 2);
				}
			},


			updateResultLatents () {
				for (let i = 0; i < this.latentLayers; ++i)
					this.updateResultLatentsLayer(i);
			},


			onCopy (event) {
				event.clipboardData.setData("text/plain", "w+:" + this.resultLatentsBytes);
				console.log("Result latent code copied into clipboard.");
			},


			onAggregationChosen () {
				//console.log("onAggregationChosen:", event);
				const chosen = this.aggregationStatus === "ALL";
				this.bars.forEach(bar => bar.chosen = !chosen);
			},
		},


		watch: {
			latentLayers () {
				this.bars = Array(this.latentLayers).fill(null).map((_, i) => ({
					index: i,
					chosen: true,
					value: 0,
				}));

				this.updateResultLatents();
			},


			resultLatentsBytes () {
				this.resultUpdateTime = Date.now();
				setTimeout(() => {
					if (Date.now() - this.resultUpdateTime > 290)
						this.cachedResultCode = this.resultLatentsBytes;
				}, 300);
			},


			resultImageURL () {
				this.resultLoading = true;
			},
		},
	};
</script>

<style>
	html
	{
		overflow: hidden;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	.initializing
	{
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		right: 0;
		font-size: 10vh;
		padding: 30vh 2em 0;
		white-space: normal;
		background-color: #ccca;
		color: #444c;
	}

	.g-view
	{
		display: inline-block;
	}

	.turner .index
	{
		font-size: 10px;
		width: 2.4em;
		max-width: 2.4em;
		text-align: right;
		user-select: none;
	}

	.turner .value
	{
		font-size: 11px;
	}

	.turner .slider input
	{
		width: 320px;
	}

	body
	{
		overflow: hidden;
	}

	.merger
	{
		position: relative;
	}

	main
	{
		position: absolute;
		left: 420px;
		top: 0;
	}

	.result
	{
		height: calc(100vh - 24px);
	}

	.loading img
	{
		opacity: 0.7;
	}

	.chosen input.status-PART::before
	{
		display: inline-block;
		position: relative;
		content: "\25a0";
		color: #666;
		font-size: 16px;
		top: -4px;
		left: 1px;
	}
</style>