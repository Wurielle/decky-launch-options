import os

SETTINGS_FOLDER_NAME = '.dlo'
SETTINGS_FOLDER_PATH = os.path.join(os.path.expanduser('~'), SETTINGS_FOLDER_NAME)
SETTINGS_PATH = f"{os.path.join(SETTINGS_FOLDER_PATH, 'settings.json')}"
