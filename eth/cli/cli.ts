import { deleteDeployment } from "./tasks/deleteDeployment";
import { deploy } from "./tasks/deploy";
import { updateClient } from "./tasks/updateClient";

const main = () => {
    const command = process.argv[2];
    if (command === "deploy") {
        deploy();
    } else if (command === "delete-deployment") {
        deleteDeployment();
    } else if (command === "update-client") {
        updateClient();
    }
};
main();
