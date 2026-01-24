import os

CONFIG_FOLDER_NAME = 'dlo'
CONFIG_FOLDER_PATH = os.path.join(os.path.expanduser('~'), CONFIG_FOLDER_NAME)
CONFIG_PATH = f"{os.path.join(CONFIG_FOLDER_PATH, 'config.json')}"
