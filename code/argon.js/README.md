# argon.js

An open-standards augmented reality platform for the web


### Quick Build Guide

* Clone argon.js

```sh
git clone https://github.gatech.edu/ael/argon.js.git
```

* Make sure you have Node.js/npm installed (There are many guides for this online)

* Go to the directory where you have argon.js downloaded and install dependencies using npm

```sh
npm install
```

* Install gulp globally so that the gulp command works. 

```sh
npm install -g gulp
```

* Use gulp to build Argon. 
 
```sh
gulp build
```

* The `dev` task will automatically watch for changes and rebuild your code as needed.  

```sh
gulp dev
```

### Potential Problems

On Debian based systems, node.js has a name conflict with another module and as a result npm will not work properly. To fix this, run the following:

```sh
sudo apt-get install nodejs-legacy
```
