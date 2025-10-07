import { db } from "#config/database.js";
import logger from "#config/logger.js"
import { accounts } from "#models/user.model.js";
import { eq } from "drizzle-orm";
import bcrypt from 'bcrypt'

export const hashPassword =  async (password) => { 
    try {
        return await bcrypt.hash(password, 10)
    } catch (e) {
        logger.error(`Error hashing the password: ${e}`);
        throw new Error('Error hashing');
    }
}

export const createUser = async ({name, email, password, role = 'user'}) => {
    try {
        const existingUser = db.select().from(accounts).where(eq(accounts.email, email)).limit(1);

        if ((await existingUser).length > 0) throw new Error('User already exists');

        const password_hash = await hashPassword(password);

        const [newUser] = await db.insert(accounts).values({
            full_name: name,
            email,
            password: password_hash,
            role
        }).returning({id: accounts.id, full_name: accounts.full_name, email: accounts.email, role: accounts.role, created_at: accounts.created_at});

        logger.info(`User ${newUser.email} created successfully`);
        return newUser;
        
    } catch (e) {
        logger.error(`Error creating user: ${e}`);
        throw e;
    }
}

export const comparePassword = async (password, hashedPassword) => {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (e) {
        logger.error(`Error comparing password: ${e}`);
        throw new Error('Error comparing password');
    }
}

export const authenticateUser = async ({ email, password }) => {
    try {
        const [user] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        const isPasswordValid = await comparePassword(password, user.password);
        
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }
        
        logger.info(`User ${email} authenticated successfully`);
        
        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
        
    } catch (e) {
        logger.error(`Authentication error: ${e}`);
        throw e;
    }
}
