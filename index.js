const core = require("@actions/core");
const YouTube = require("youtube-node");
const { Octokit } = require('@octokit/core')

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const youTube = new YouTube();

String.prototype.isEmpty = function () {
    return (this.length === 0 || !this.trim());
};

let doAsync = (func, ...params) => {
    return new Promise((resolve, reject) => {
        params.push((error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
        func(...params);
    });
}

(async () => {

    const username = process.env.GITHUB_REPOSITORY.split("/")[0]
    const repo = process.env.GITHUB_REPOSITORY.split("/")[1]
    const getReadme = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: username,
        repo: repo,
        path: "README.md",
    }).catch(e => {
        console.error("Failed: ", e)
        core.setFailed("Failed: " + e.message)
    })
    const sha = getReadme.data.sha

    const YOUTUBE_API_KEY = core.getInput("youtubeApiKey", {required: true});
    const YOUTUBE_CHANNEL_ID = core.getInput("youtubeChannelId", {required: true});

    youTube.setKey(YOUTUBE_API_KEY);

    let channelData = await doAsync(youTube.getChannelById, YOUTUBE_CHANNEL_ID)
        .catch(e => {
            console.error("Failed: ", e)
            core.setFailed("Failed: " + e.message)
        });

    let channelId = channelData["items"][0]["id"];
    let channelName = channelData["items"][0]["snippet"]["title"];
    let uploadsPlaylistId = channelData["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"];
    console.log(uploadsPlaylistId);

    youTube.clearParams();
    youTube.clearParts();

    var data = "### Hi there 👋\n" +
        "---\n";
    data += "## " + channelName;

    let uploads = await doAsync(youTube.getPlayListsItemsById, uploadsPlaylistId, 10)
        .catch(e => {
            console.error("Failed: ", e)
            core.setFailed("Failed: " + e.message)
        });
    let items = uploads["items"];
    let first = items.shift();
    if (first) {
        console.log(first["snippet"]["title"]);
        console.log(JSON.stringify(first, null, ' '));
    }

    await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: username,
        repo: repo,
        path: "README.md",
        message: '(Automated) Update README.md',
        content: Buffer.from(data, "utf8").toString('base64'),
        sha: sha,
    }).catch((e) => {
        console.error("Failed: ", e)
        core.setFailed("Failed: " + e.message)
    })
    // console.log(JSON.stringify(uploads, null, ' '));
})()
