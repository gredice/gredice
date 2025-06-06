import { migrate } from './storage';

const main = async () => {
    try {
        console.info('Starting migration...');
        const start = Date.now();
        await migrate();
        console.info('Migration completed in', Date.now() - start, 'ms');
    } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
    }
};

main();
