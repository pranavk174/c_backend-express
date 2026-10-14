import prisma from "../../../prisma/prisma-client";

export const updateLastSeen = async(payload)=>{

    try {
        const update = await prisma.$queryRaw`
        
        INSERT INTO user_presence (
            updated_at,
            last_seen,
            user_id
            )
            
            VALUES (
            ${CURRENT_TIMESTAMP},
            ${CURRENT_TIMESTAMP},
            ${payload.userId}
            )
            
            ON CONFLICT (user_id)
            
            DO UPDATE
            SET 
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP returning *;

        
        `
    } catch (error) {
        return {
    
        }
    }
}