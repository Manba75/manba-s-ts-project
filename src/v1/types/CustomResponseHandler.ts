import {Response}  from 'express'

 export interface CustomResponseHandler <T = any>{
    success: boolean;
    message: string;
    data?: T;
}