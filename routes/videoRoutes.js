// define video routes
const express = require("express");
const router = express.Router();
const ytdl = require("ytdl-core");
const fs = require("fs");
const axios = require("axios");
const mongoose = require("mongoose");
const Video = require("../db/schema/videos");
const YoutubeTranscript = require("youtube-transcript").YoutubeTranscript;
const Anthropic = require("@anthropic-ai/sdk");
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { google } = require("googleapis");

const endpoint = "https://hoo-ai.openai.azure.com/";
const apiKey = process.env.OPENAI;

const concatenateTexts = (textArray) => {
	let concatenatedText = "";
	textArray.forEach((item) => {
		concatenatedText += item.text + " ";
	});
	return concatenatedText.trim();
};

const generateNotes = async (transcript) => {
	const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
	const messages = [
		{
			role: "system",
			content:
				"Suppose you're the best teacher in the world, who has the best knowledge. You are very proficient in diverse sets of topics. You are always keeping yourself updated with the internet. You can read and understand the entire 3 hour lecture transcripts in just a few seconds. Being the best teacher means you can also become the best student, your ideal student. You're given a transcript starting and ending with &&& signs. Your job is to generate class notes just like how your ideal student will take notes in order to get full marks. But instead of writing in paper, you've to write in html formatting, in such a way that it is easily readable and understandable by students. Your output must be in HTML format, and keep in mind that the generated text will be used inside <body> tag. Your response should be well formated HTML code. The HTML code must have css styling to it, even for basics like h1, h2 because all are set to none",
		},
		{ role: "user", content: `&&& ${transcript} &&&` },
	];
	let output = "";
	try {
		const events = await client.streamChatCompletions("hoo-33", messages, {
			maxTokens: 2048,
		});

		for await (const event of events) {
			for (const choice of event.choices) {
				const delta = choice.delta?.content;
				if (delta !== undefined) {
					output += delta;
				}
			}
		}
		console.log(output);
	} catch (error) {
		console.error("Error:", error);
	}
	return output;
};

const generateSuggestions = async (transcript) => {
	const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
	const messages = [
		{
			role: "system",
			content:
				"Suppose you're the best teacher in the world, who has the best knowledge. You are very proficient in diverse sets of topics. You are always keeping yourself updated with the internet. You'll be provided a lecture transcript starting and ending with &&& you need to Suggest only 4 topics with minimum 4 words from the transcript the student might have difficulty to understand.  Your response must be in stringified json format. Your json should be like this: {maintopic: 'main topic', subtopics [topic1, topic2, topic3, topic4]}",
		},
		{ role: "user", content: `&&& ${transcript} &&&` },
	];
	let output = "";
	try {
		const events = await client.streamChatCompletions("hoo-33", messages, {
			maxTokens: 2048,
		});

		for await (const event of events) {
			for (const choice of event.choices) {
				const delta = choice.delta?.content;
				if (delta !== undefined) {
					output += delta;
				}
			}
		}
		console.log(output);
	} catch (error) {
		console.error("Error:", error);
	}
	return output;
};

router.route("/upload").post(async (req, res) => {
	console.log(req.body);
	try {
		const { url } = req.body;
		if (!url) {
			return res.status(400).send("URL is required");
		}
		let transcript;

		if (ytdl.validateURL(url)) {
			try {
				transcript = await YoutubeTranscript.fetchTranscript(url).then(
					(d) => concatenateTexts(d)
				);
			} catch (error) {
				return res.status(400).send("Transcript not available");
			}
			fs.writeFileSync(
				`./transcripts/${url.split("=")[1]}.txt`,
				transcript
			);
		} else {
			async function downloadVideo(url) {
				const response = await axios.get(url, {
					responseType: "stream",
				});
				const contentType = response.headers["content-type"];

				if (
					contentType !== "video/mp4" &&
					contentType !== "video/x-matroska"
				) {
					return false;
				}

				const fileName = `tmp.${contentType.split("/")[1]}`;
				const path = `./videos/${fileName}`;

				const writer = fs.createWriteStream(path);
				response.data.pipe(writer);

				return new Promise((resolve, reject) => {
					writer.on("finish", () => resolve(path));
					writer.on("error", reject);
				});
			}

			videoPath = await downloadVideo(url);
			if (!videoPath) {
				return res
					.status(400)
					.send("Format not valid, choose direct .mp4 or .mkv links");
			}
		}

		const newVideo = new Video({
			url,
			transcript: transcript || "",
		});

		await newVideo.save();

		let notes2 = await generateNotes(transcript);
		// Store video information to MongoDB

		return res.status(200).json({
			message: "Video downloaded and stored successfully",
			videoId: newVideo._id,
			notes: notes2,
		});
	} catch (error) {
		console.error(error);
		return res.status(500).send("Internal Server Error");
	}
});

const youtube = google.youtube({
	version: "v3",
	auth: process.env.GOOGLE, // Replace 'YOUR_API_KEY_HERE' with your actual API key
});

async function searchYouTubeVideos(query) {
	try {
		// Make a search request to the YouTube Data API
		const response = await youtube.search.list({
			part: "snippet",
			q: query,
			maxResults: 1, // Number of results to retrieve
			type: "video", // Search for videos only
		});

		// Extract relevant information from the API response
		const videos = response.data.items.map((item) => ({
			title: item.snippet.title,
			description: item.snippet.description,
			videoId: item.id.videoId,
			thumbnail: item.snippet.thumbnails.default.url,
		}));

		return videos;
	} catch (error) {
		console.error("Error searching YouTube videos:", error.message);
		throw error;
	}
}

router.route("/suggest").post(async (req, res) => {
	// create a function that suggests videos based on the transcript to help students understand the topic better,
	// FIND transcript of video by YouTube video ID SEND IN req.body.url
	const { url } = req.body;
	let transcript = await Video.findOne({ url: url });
	transcript = transcript.transcript;

	let suggestions = await generateSuggestions(transcript)
    .then(async (suggestions) => {
        let sgs = JSON.parse(suggestions);
        let videos = [];
    
        // Map over the subtopics and create an array of promises
        let videoPromises = sgs.subtopics.map((topic) => {
            // Return the promise returned by searchYouTubeVideos
            return searchYouTubeVideos(topic).then((result) => {
                console.log(result);
                // Push the first video to the videos array
                videos.push(result[0]);
            });
        });
    
        // Wait for all promises to settle
        await Promise.all(videoPromises);
    
        // Once all promises are settled, return the videos array
        return videos;
    })
		.catch((error) => {
            console.error("Failed to generate suggestions:", error);
			return res.status(500).send("Internal Server Error");
		});
        res.status(200).json({  suggestions: suggestions });
});
module.exports = router;
