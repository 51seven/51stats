51stats REST API
=======

This is a wrapper for some statistics of a bunch of people made with some APIs.

### How do I include an API?
Simply add a file into the `api`-directory. The name of your file will be the route (without the `.js` extension).

### Structure configs
You can put a few configurations of your API module into the `config`-directory. Would be great if the name of the file is somehow related to the module.

### The provided example with the Twitter API won't work!!1
The API Keys for Twitter are censored. For testing register your own twitter app.

### Securing your API keys
Open accessible API keys are meh. You can put them into a configuration file, censor them (maybe with `xxxx`), add the file to the `.gitignore`, push the whole thing and then insert them again. No one will see them (unless you want to update your config-file).
