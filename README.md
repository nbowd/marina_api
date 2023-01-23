# Marina API
Full featured Marina API that models users, boats, and loads. Allowing registered users full CRUD capabilities for boats and loads and the ability to create relationships between the entities.

## Features

* Utilizes GCP for user management and as a datastore.
* Allows users to use their Google account to create authorization credentials, allowing them to create/edit boat entities.
* Uses JWT to validate and authorize users for endpoints related to boats.
* Create, Read, Update, Delete endpoints for both "loads" and "boats" entities.
* Users can place or remove loads from boats, updating both entities information.

# Documentation

Please refer to the API spec for more detailed usage information for each endpoint. 
[API Documentation](../blob/main/marina_API_documentation.pdf)
