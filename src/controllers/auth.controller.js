import { signupSchema, signinSchema } from '#validations/auth.validation.js'
import { formatValidationError } from '#utils/format.js';
import { createUser, authenticateUser } from '#services/auth.service.js';
import { jwttoken } from '#utils/jwt.js'
import { cookies } from '#utils/cookies.js'
import logger from '#config/logger.js';

export const signup = async (req, res, next) => {
    try {
        const validatedResult = signupSchema.safeParse(req.body);

        if(!validatedResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: formatValidationError(validatedResult.error)
            })
        }

        const {name, email, password, role } = validatedResult.data

        const user = await createUser({ name, email, password, role });

        const token = jwttoken.sign({id: user.id, email: user.email, role: user.role});

        cookies.set(res, 'token', token);

        logger.info(`User registered successfully: ${email}`)
        res.status(201).json({
            message: 'User registered',
            user: {
                id: user.id, 
                name: user.full_name, 
                email: user.email, 
                role: user.role
            }
        });
    } catch (e) {
        logger.error('Signup error', e)

        if(e.message === 'User already exists') {
            return res.status(400).json({ error: 'Email already exists'})
        }

        next(e);
    }
}

export const signin = async (req, res, next) => {
    try {
        const validatedResult = signinSchema.safeParse(req.body);

        if (!validatedResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: formatValidationError(validatedResult.error)
            })
        }

        const { email, password } = validatedResult.data;

        const user = await authenticateUser({ email, password });

        const token = jwttoken.sign({ id: user.id, email: user.email, role: user.role });

        cookies.set(res, 'token', token);

        logger.info(`User signed in successfully: ${email}`);
        res.status(200).json({
            message: 'User signed in successfully',
            user: {
                id: user.id,
                name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (e) {
        logger.error('Signin error', e);

        if (e.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }

        if (e.message === 'Invalid password') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        next(e);
    }
}

export const signout = async (req, res, next) => {
    try {
        cookies.clear(res, 'token');
        
        logger.info('User signed out successfully');
        res.status(200).json({
            message: 'User signed out successfully'
        });
    } catch (e) {
        logger.error('Signout error', e);
        next(e);
    }
}
