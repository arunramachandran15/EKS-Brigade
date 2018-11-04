const { events, Job } = require("brigadier");



events.on("exec", (e, project) => {
  console.log("Hey hey hey exec hook fired");
});

events.on("push", (e, project) => {
  console.log("received push for commit " + e.commit)

  var testJob = new Job("test-runner")

  testJob.image = "python:3"

  testJob.tasks = [
    "cd /src/",
    "pip install -r requirements.txt",
    "cd /src/",
    "python setup.py test"
  ]

  testJob.run().then( () => {
    events.emit("test-done", e, project)
  })
})

events.on("test-done", (e, project) => {
  console.log("Building docker image")

  var dockerBuild = new Job("docker-build")

  dockerBuild.image = "docker:dind"
  dockerBuild.privileged = true;

  dockerBuild.env = {
    DOCKER_DRIVER: "overlay"
  }

  dockerBuild.env.DOCKER_USER = project.secrets.dockerLogin
  dockerBuild.env.DOCKER_PASS = project.secrets.dockerPass

  dockerBuild.tasks = [
    "dockerd-entrypoint.sh &",
    "sleep 20",
    "cd /src/",
    "docker build -t arun15/brigade-test:latest .",
    "docker login -u $DOCKER_USER -p $DOCKER_PASS",
    "docker push arun15/brigade-test:latest"
  ]

  dockerBuild.run().then( () => {
    events.emit("build-done", e, project)
  })
})

events.on("build-done", (e, project) => {
  console.log("Deploying to cluster")

  var deploy = new Job("deploy-runner", "tettaji/kubectl:1.9.0")

  deploy.tasks = [
    "cd /src",
    "kubectl apply -f deploy.yml"
  ]

  deploy.run().then( () => {
    events.emit("success", e, project)
  })
})

