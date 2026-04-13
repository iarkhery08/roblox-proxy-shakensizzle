const {EmbedBuilder, SlashCommandBuilder, CommandInteraction, PermissionFlagBits, Client} = require("discord.js")
const roblox = require('noblox.js');
require('dotenv').config();

async function getRankName(func_group, func_user){
    let rolename = await roblox.getRankNameInGroup(func_group, func_user);
    return rolename;
}

async function getRankID(func_group, func_user){
    let role = await roblox.getRankInGroup(func_group, func_user);
    return role;
}

async function getRankFromName(func_rankname, func_group){
    let roles = await roblox.getRoles(func_group);
    let role = await roles.find(rank => rank.name == func_rankname);
    if(!role){
        return 'NOT_FOUND';
    }
    return role.rank;
}

module.exports = {
	data: new SlashCommandBuilder()
	.setName('rank')
		.setDescription('Ranks a specific user to a specific rank')
   .addStringOption(option =>
		option.setName('user')
			.setDescription('Player you are trying to rank')
			.setRequired(true)) 
   .addStringOption(option =>
		option.setName('rank')
			.setDescription('Rank you are trying to rank to')
			.setRequired(true)),  

	async execute(interaction) {
     if(!interaction.member.roles.cache.some(role =>["Ranking Permissions"].includes(role.name))){
		await interaction.reply({ content: 'You need the role **Ranking Permissions** to use this command!', ephemeral: false });
    } else {
         const username = interaction.options.getString('user') ?? 'No reason provided';
		 const rank = interaction.options.getString('rank') ?? 'No reason provided';

        try {
        const userId = await roblox.getIdFromUsername(username);
        const rankName2  = await roblox.getRankNameInGroup(process.env.groupid, userId)

        console.log(userId)
        roblox.setRank(Number(process.env.groupid), userId, rank)
        
          const RankingLog = new EmbedBuilder() 
         .setColor(15548997)
         .setTitle('Ranking Logs')
         .setDescription(`User Who's Ranking: **${interaction.user}**
         
         User Getting Ranked: **${username}**
         
         New Rank: **${rank}**
         
         Old Rank: **${rankName2}**`)
         .setTimestamp()
         .setFooter({ text: 'Ranking System By: iArkhery'}); 

        await interaction.guild.channels.cache.get(process.env.RankingLogs).send({ embeds: [RankingLog] })
        await interaction.reply({ content: `Ranked **${username}** to **${rank}**!`, ephemeral: false });

        } catch (error) {
          console.error(error);
          await interaction.reply({ content: `An error has occured try again!`, ephemeral: false });
        }
    } 
	},
};  