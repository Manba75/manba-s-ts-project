
// import express, { Request, Response } from "express";
// import { exec } from "child_process";
// import { NextFunction } from "express-serve-static-core";
// import { functions } from "../library/functions";
// // import  from "express";

// const router = express.Router();

// const ENVIRONMENT = process.env.NODE_ENV;

// if (ENVIRONMENT === "development" || ENVIRONMENT === "localhost") {
      
//        router.post('/excute-command', excuteCommand);
// }
// module.exports = router;

// async function  excuteCommand(req: any, res: any) {
    
//     const { folder, repo} = req.body;
//     //  if (!folder || !repo || !branch || !pm2Process) {
//     //         return res.status(400).send("Folder, Repo, Branch and PM2 Process are required");
//     //  }      


//      let command = `cd ${folder} &&  git pull ${repo}   && pm2 reload 0 && pm2 logs 0`;
//      console.log(`Executing command: ${command}`);    
//      if (!command) {
//         res.status(400).send("Command is required");
//         return
//      }

//      exec(command, (error, stdout, stderr) => {
//             if (error) {
//                    console.error(`Error executing command: ${error.message}`);
//                     res.status(500).send(`Error executing command: ${error.message}`);
//                     return
//             }
//             if (stderr) {
//                    console.error(`Error output: ${stderr}`);
//                     res.status(500).send(`Error output: ${stderr}`);
//                     return
//             }
//             console.log(`Command output: ${stdout}`);
//             res.send(`Command output: ${stdout}`);
//      });
    
     
// }