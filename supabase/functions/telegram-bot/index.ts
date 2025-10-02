/*import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Log every single request for debugging
  console.log('=== INCOMING REQUEST ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))

  try {
    const BOT_TOKEN = Deno.env.get('BOT_TOKEN')!
    const TELEGRAM_GROUP_ID = Deno.env.get('TELEGRAM_GROUP_ID')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!BOT_TOKEN || !TELEGRAM_GROUP_ID) {
      throw new Error('Missing required environment variables')
    }

    console.log('Environment check - BOT_TOKEN exists:', !!BOT_TOKEN)
    console.log('Environment check - TELEGRAM_GROUP_ID:', TELEGRAM_GROUP_ID)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { method } = req
    
    // Handle GET requests (health check)
    if (method === 'GET') {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          message: 'Telegram bot function is running',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (method === 'POST') {
      let body
      try {
        body = await req.json()
        console.log('=== POST REQUEST BODY ===')
        console.log(JSON.stringify(body, null, 2))
        console.log('=== END POST BODY ===')
      } catch (e) {
        console.error('Failed to parse JSON:', e)
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Handle Telegram webhook updates
      if ('message' in body || 'chat_member' in body) {
        console.log('=== DETECTED TELEGRAM WEBHOOK ===')
        console.log('Has message:', 'message' in body)
        console.log('Has chat_member:', 'chat_member' in body)
        return await handleTelegramWebhook(body, supabase, BOT_TOKEN, TELEGRAM_GROUP_ID)
      }
      
      // Handle invite link generation requests
      if ('action' in body && body.action === 'generate_invite') {
        console.log('=== DETECTED INVITE LINK REQUEST ===')
        return await generateInviteLink(body, supabase, BOT_TOKEN, TELEGRAM_GROUP_ID)
      }
      
      console.log('=== UNRECOGNIZED POST REQUEST ===')
      console.log('Body keys:', Object.keys(body))
      
      // If this looks like a Telegram update but we didn't catch it above, handle it anyway
      if (body.update_id !== undefined) {
        console.log('=== FALLBACK TELEGRAM WEBHOOK HANDLING ===')
        return await handleTelegramWebhook(body, supabase, BOT_TOKEN, TELEGRAM_GROUP_ID)
      }
      
      // Return success for any POST to avoid webhook errors
      return new Response(
        JSON.stringify({ success: true, message: 'Request processed' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed or invalid request' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in telegram-bot function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function generateInviteLink(body: any, supabase: any, botToken: string, groupId: string) {
  const { user_id, email } = body

  if (!user_id || !email) {
    return new Response(
      JSON.stringify({ error: 'Missing user_id or email' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Debug: Log the group ID being used
    console.log('Attempting to create invite link for group:', groupId)
    
    // First, let's check if bot is admin in the group
    try {
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
      const botInfo = await botInfoResponse.json()
      if (botInfo.ok) {
        console.log('Bot info:', botInfo.result.username, botInfo.result.id)
        
        // Check bot's status in the group
        const statusResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: groupId,
            user_id: botInfo.result.id
          })
        })
        
        const statusData = await statusResponse.json()
        console.log('Bot status in group:', statusData)
        
        if (!statusData.ok) {
          throw new Error(`Bot is not in group or group ID is wrong: ${statusData.description}`)
        }
        
        if (statusData.result.status !== 'administrator') {
          throw new Error(`Bot is not admin in group. Current status: ${statusData.result.status}`)
        }
      }
    } catch (debugError) {
      console.error('Debug check failed:', debugError)
      // Continue anyway, maybe the API call will work
    }

 
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: groupId,
        name: `Invite for ${email}`,
        member_limit: 1, // Samo jedna osoba može koristiti ovaj link
        expire_date: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Ističe za 24h
      }),
    })

    const telegramData = await telegramResponse.json()
    console.log('Telegram API response:', telegramData)

    if (!telegramData.ok) {
      throw new Error(`Telegram API error: ${telegramData.description}`)
    }

    const inviteLink = telegramData.result.invite_link

    // Čuvanje linka u bazi
    const { error: updateError } = await supabase
      .from('auth_users')
      .update({ invite_link: inviteLink })
      .eq('user_id', user_id)
      .eq('email', email)

    if (updateError) {
      throw new Error(`Database error: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invite_link: inviteLink,
        message: 'Invite link generated successfully'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error generating invite link:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate invite link' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

async function handleTelegramWebhook(update: any, supabase: any, botToken: string, groupId: string) {
  try {
    console.log('=== WEBHOOK UPDATE RECEIVED ===')
    console.log('Update keys:', Object.keys(update))
    console.log('Full update:', JSON.stringify(update, null, 2))
    console.log('Group ID configured:', groupId)
    
    // Check what type of update this is
    if (update.message) {
      console.log('=== MESSAGE UPDATE ===')
      console.log('Message type:', update.message.text ? 'text' : 'other')
      console.log('Chat ID:', update.message.chat.id)
      console.log('From user:', update.message.from.username || update.message.from.first_name)
    }
    
    if (update.chat_member) {
      console.log('=== CHAT MEMBER UPDATE ===')
      console.log('Chat ID:', update.chat_member.chat.id)
      console.log('User:', update.chat_member.new_chat_member.user.username || update.chat_member.new_chat_member.user.first_name)
      console.log('Old status:', update.chat_member.old_chat_member?.status)
      console.log('New status:', update.chat_member.new_chat_member?.status)
    }
    
    if (update.my_chat_member) {
      console.log('=== MY CHAT MEMBER UPDATE (bot status changed) ===')
      console.log('Chat ID:', update.my_chat_member.chat.id)
      console.log('Old status:', update.my_chat_member.old_chat_member?.status)
      console.log('New status:', update.my_chat_member.new_chat_member?.status)
    }
    
    // Handle admin commands
    if (update.message && update.message.text && update.message.text.startsWith('/')) {
      console.log('Processing admin command:', update.message.text)
      return await handleAdminCommands(update, supabase, botToken, groupId)
    }
    
    // Handle new chat member (someone joined via invite link)
    if (update.chat_member && update.chat_member.new_chat_member) {
      const newMember = update.chat_member.new_chat_member
      const chatId = update.chat_member.chat.id
      
      console.log('=== CHAT MEMBER UPDATE ===')
      console.log('New chat member detected:', {
        userId: newMember.user.id,
        username: newMember.user.username,
        firstName: newMember.user.first_name,
        status: newMember.status,
        chatId: chatId
      })
      
      // Check if this is for our target group
      if (chatId.toString() !== groupId) {
        console.log(`Ignoring update from different group: ${chatId} vs ${groupId}`)
        return new Response(JSON.stringify({ success: true }), { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Check if user joined (status changed to 'member')
      if (newMember.status === 'member') {
        console.log('User joined group, checking authorization...')
        // First check if user is authorized (has username and is in database)
        await checkAndKickUnauthorizedMember(newMember.user, chatId, supabase, botToken, groupId)
        
        // Then handle invite link verification if present
        if (update.chat_member.invite_link) {
          const inviteLink = update.chat_member.invite_link.invite_link
          
          console.log('User joined via invite link:', inviteLink)
          
          const { error: updateError } = await supabase
            .from('auth_users')
            .update({ added: true })
            .eq('invite_link', inviteLink)

          if (updateError) {
            console.error('Error updating user status:', updateError)
          } else {
            console.log(`Successfully marked user as added for invite link: ${inviteLink}`)
          }
        }
      }
    }
    
    // Also handle regular new_chat_members array (alternative format)
    if (update.message && update.message.new_chat_members) {
      const newMembers = update.message.new_chat_members
      console.log('New chat members from message:', newMembers)
      
      // Check each new member
      for (const member of newMembers) {
        console.log('New member joined:', {
          userId: member.id,
          username: member.username,
          firstName: member.first_name
        })
        
        // Check if user is authorized
        await checkAndKickUnauthorizedMember(member, update.message.chat.id, supabase, botToken, groupId)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error handling webhook:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Webhook processing failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

// Handle admin commands
async function handleAdminCommands(update: any, supabase: any, botToken: string, groupId: string) {
  const message = update.message
  const chatId = message.chat.id
  const userId = message.from.id
  const command = message.text.split(' ')[0].toLowerCase()
  
  // Check if message is from the target group
  if (chatId.toString() !== groupId) {
    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(userId, chatId, botToken)
  if (!isAdmin) {
    await sendMessage(chatId, '❌ Ova komanda je dostupna samo adminima.', botToken)
    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  try {
    switch (command) {
      case '/status':
        await handleStatusCommand(chatId, supabase, botToken, groupId)
        break
      case '/purge':
        await handlePurgeCommand(chatId, supabase, botToken, groupId)
        break
      case '/check':
        await handleCheckCommand(message, chatId, supabase, botToken, groupId)
        break
      case '/help':
        await handleHelpCommand(chatId, botToken)
        break
      
      case '/members':
        await handleMembersCommand(chatId, supabase, botToken, groupId)
        break
      default:
        // Not a recognized admin command, ignore
        break
    }
  } catch (error) {
    console.error('Error handling admin command:', error)
    await sendMessage(chatId, '❌ Greška pri izvršavanju komande.', botToken)
  }
  
  return new Response(JSON.stringify({ success: true }), { 
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Check if user is admin in the group
async function checkIfUserIsAdmin(userId: number, chatId: string, botToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: userId
      })
    })
    
    const data = await response.json()
    
    if (data.ok) {
      const status = data.result.status
      return status === 'creator' || status === 'administrator'
    }
    return false
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// Handle /status command
async function handleStatusCommand(chatId: string, supabase: any, botToken: string, groupId: string) {
  try {
    // Get comprehensive database stats
    const { count: totalUsers } = await supabase
      .from('auth_users')
      .select('*', { count: 'exact', head: true })
    
    const { count: usersWithUsername } = await supabase
      .from('auth_users')
      .select('*', { count: 'exact', head: true })
      .not('telegram_username', 'is', null)
    
    const { count: verifiedUsers } = await supabase
      .from('auth_users')
      .select('*', { count: 'exact', head: true })
      .eq('added', true)
    
    const { count: usersWithInviteLink } = await supabase
      .from('auth_users')
      .select('*', { count: 'exact', head: true })
      .not('invite_link', 'is', null)
    
    // Get group member count
    const memberCount = await getGroupMemberCount(groupId, botToken)
    
    // Get recent activity - users who got invite links in last 24h
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const { count: recentInvites } = await supabase
      .from('auth_users')
      .select('*', { count: 'exact', head: true })
      .not('invite_link', 'is', null)
      .gte('updated_at', yesterday.toISOString())
    
    // Calculate potential issues
    const usersWithoutUsername = (totalUsers || 0) - (usersWithUsername || 0)
    const unverifiedUsers = (usersWithUsername || 0) - (verifiedUsers || 0)
    
    const statusMessage = `📊 *STATUS IZVEŠTAJ*\n\n` +
      `👥 *Baza podataka:*\n` +
      `• Ukupno korisnika: ${totalUsers || 0}\n` +
      `• Sa Telegram username-om: ${usersWithUsername || 0}\n` +
      `• Verifikovani (u grupi): ${verifiedUsers || 0}\n` +
      `• Sa invite link-om: ${usersWithInviteLink || 0}\n\n` +
      `💬 *Telegram grupa:*\n` +
      `• Ukupno članova: ${memberCount}\n\n` +
      `⚠️ *Potencijalni problemi:*\n` +
      `• Bez username-a: ${usersWithoutUsername}\n` +
      `• Neverifikovani: ${unverifiedUsers}\n\n` +
      `📈 *Poslednja 24h:*\n` +
      `• Novi invite linkovi: ${recentInvites || 0}\n\n` +
      `ℹ️ *Napomene:*\n` +
      `• Telegram API ograničava pristup listi članova\n` +
      `• Bot automatski uklanja neautorizovane korisnike\n` +
      `• Koristi \`/check @username\` za proveru korisnika\n` +
      `• Koristi \`/purge\` za pokretanje čišćenja`
    
    await sendMessage(chatId, statusMessage, botToken)
    
  } catch (error) {
    console.error('Error in status command:', error)
    await sendMessage(chatId, '❌ Greška pri dobijanju statistika.', botToken)
  }
}

// Handle /purge command
async function handlePurgeCommand(chatId: string, supabase: any, botToken: string, groupId: string) {
  try {
    await sendMessage(chatId, '🔍 Pretražujem problematične članove...', botToken)
    
    // Get group members (administrators and those we can access)
    const groupMembers = await getAllGroupMembers(groupId, botToken)
    
    if (groupMembers.length === 0) {
      await sendMessage(chatId, 
        '❌ *Nije moguće dobiti listu članova*\n\n' +
        'Telegram API ograničava pristup listi članova.\n' +
        'Bot će automatski proveravati nove članove kada se pridruže.\n\n' +
        '🤖 **Automatska zaštita je aktivna:**\n' +
        '• Novi članovi bez username-a se automatski uklanjaju\n' +
        '• Novi članovi koji nisu u bazi se automatski uklanjaju', botToken)
      return
    }

    // Get usernames from database
    const { data: usersInDB } = await supabase
      .from('auth_users')
      .select('telegram_username')
      .not('telegram_username', 'is', null)
    
    const dbUsernames = new Set((usersInDB || []).map((user: any) => user.telegram_username?.toLowerCase()))
    
    // Find problematic members (in group but not in database)
    const problematicMembers = groupMembers.filter(member => {
      // Problematic if no username or username not in database
      return !member.user.username || !dbUsernames.has(member.user.username.toLowerCase())
    })
    
    if (problematicMembers.length === 0) {
      await sendMessage(chatId, '✅ Nema problematičnih članova u dostupnoj listi!', botToken)
      return
    }

    let message = `⚠️ *PROBLEMATIČNI ČLANOVI* (${problematicMembers.length})\n\n`
    message += `Članovi koji su u grupi ali nisu u bazi:\n\n`
    
    problematicMembers.forEach((member, index) => {
      const name = member.user.first_name + (member.user.last_name ? ` ${member.user.last_name}` : '')
      const username = member.user.username || 'nema username'
      const id = member.user.id
      
      message += `${index + 1}. 👤 *${name}*\n`
      message += `   🆔 ID: ${id}\n`
      message += `   👨‍💻 Username: @${username}\n`
      if (!member.user.username) {
        message += `   ❌ Razlog: Nema username\n`
      } else {
        message += `   ❌ Razlog: Username nije u bazi\n`
      }
      message += '\n'
    })

    message += '\n🤖 **Bot automatski uklanja nove problematične članove**'

    // Split message if too long
    if (message.length > 4000) {
      const chunks = splitLongMessage(message, 4000)
      for (const chunk of chunks) {
        await sendMessage(chatId, chunk, botToken)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } else {
      await sendMessage(chatId, message, botToken)
    }
    
  } catch (error) {
    console.error('Error in purge command:', error)
    await sendMessage(chatId, '❌ Greška pri pretreživanju problematičnih članova.', botToken)
  }
}

// Handle /check command
async function handleCheckCommand(message: any, chatId: string, supabase: any, botToken: string, groupId: string) {
  try {
    const text = message.text
    const parts = text.split(' ')
    
    if (parts.length < 2) {
      await sendMessage(chatId, 
        `❌ *NEISPRAVNA KOMANDA*\n\n` +
        `Korišćenje: \`/check @username\`\n` +
        `Primer: \`/check @marko123\``, botToken)
      return
    }
    
    let username = parts[1]
    // Remove @ if present
    if (username.startsWith('@')) {
      username = username.substring(1)
    }
    
    await sendMessage(chatId, `🔍 Pretražujem korisnika @${username}...`, botToken)
    
    // Search for user in database
    const { data: user, error } = await supabase
      .from('auth_users')
      .select('telegram_username, created_at, updated_at, invite_link')
      .ilike('telegram_username', username)
      .single()
    
    if (error || !user) {
      await sendMessage(chatId, 
        `❌ *KORISNIK NIJE PRONAĐEN*\n\n` +
        `Korisnik \`@${username}\` nije pronađen u bazi podataka.\n\n` +
        `Mogući razlozi:\n` +
        `• Korisnik se nije registrovao sa FON email-om\n` +
        `• Pogrešno otkucan username\n` +
        `• Korisnik nije uneo Telegram username`, botToken)
      return
    }
    
    // Check if user is actually in the group
    let isInGroupStatus = '🔍 Proveravam...'
    let groupMembershipText = 'Proveravam članstvo u grupi...'
    
    // Check group membership by username
    const groupCheck = await checkIfUserInGroupByUsername(username, groupId, botToken)
    
    if (groupCheck.inGroup) {
      isInGroupStatus = '✅ Da'
      groupMembershipText = 'Korisnik je trenutno član grupe'
    } else {
      isInGroupStatus = '❌ Ne (ili nije admin)'
      groupMembershipText = 'Korisnik NIJE u grupi ili nije admin (ne mogu proveriti obične članove)'
    }
    
    // Format user info (bez email-a)
    const registeredDate = new Date(user.created_at).toLocaleDateString('sr-RS')
    const updatedDate = new Date(user.updated_at).toLocaleDateString('sr-RS')
    const hasInviteLink = user.invite_link ? '✅ Da' : '❌ Ne'
    
    const userInfo = `👤 *INFORMACIJE O KORISNIKU*\n\n` +
      ` **Telegram:** @${user.telegram_username}\n` +
      `📅 **Registrovan:** ${registeredDate}\n` +
      `🔄 **Poslednje ažuriranje:** ${updatedDate}\n` +
      `🔗 **Ima invite link:** ${hasInviteLink}\n` +
      `👥 **Član grupe:** ${isInGroupStatus}\n\n` +
      `ℹ️ *Status:* ${groupMembershipText}`
    
    await sendMessage(chatId, userInfo, botToken)
    
  } catch (error) {
    console.error('Error in check command:', error)
    await sendMessage(chatId, '❌ Greška pri proveri korisnika.', botToken)
  }
}
// Handle /help command
async function handleHelpCommand(chatId: string, botToken: string) {
  try {
    const helpMessage = `🤖 *ADMIN KOMANDE*\n\n` +
      `📊 ** /status ** - Detaljan izveštaj o sistemu\n` +
      `• Statistike baze podataka\n` +
      `• Broj članova grupe\n` +
      `• Potencijalni problemi\n` +
      `• Aktivnost u poslednjih 24h\n\n` +
      `👥 ** /members ** - Lista članova grupe\n` +
      `• Imena, username-ovi i ID-jevi\n` +
      `• Status verifikacije\n` +
      `• Problematični članovi označeni\n\n` +
      `🧹 ** /purge ** - Lista problematičnih članova\n` +
      `• Članovi u grupi koji nisu u bazi\n` +
      `• Članovi bez username-a\n` +
      `• ID, ime i razlog problema\n\n` +
      `👤 ** /check @username ** - Proveri određenog korisnika\n` +
      `• Detaljne informacije o korisniku\n` +
      `• Status verifikacije\n` +
      `• Datum registracije\n\n` +
      `❓ ** /help ** - Prikaži ovu poruku\n\n` +
      `ℹ️ **Napomene:**\n` +
      `• Sve komande su dostupne samo adminima\n` +
      `• Bot automatski uklanja neautorizovane korisnike\n` +
      `• Za pristup grupi potreban je FON email i Telegram username`
    
    await sendMessage(chatId, helpMessage, botToken)
    
  } catch (error) {
    console.error('Error in help command:', error)
    await sendMessage(chatId, '❌ Greška pri prikazivanju pomoći.', botToken)
  }
}

// Get group member count
async function getGroupMemberCount(groupId: string, botToken: string): Promise<number> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMemberCount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: groupId })
    })
    
    const data = await response.json()
    
    if (data.ok) {
      return data.result
    }
    return 0
  } catch (error) {
    console.error('Error getting group member count:', error)
    return 0
  }
}

// Send message to chat
async function sendMessage(chatId: string, text: string, botToken: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    })
  } catch (error) {
    console.error('Error sending message:', error)
  }
}

// Handle /members command
async function handleMembersCommand(chatId: string, supabase: any, botToken: string, groupId: string) {
  try {
    await sendMessage(chatId, '🔍 Pretražujem članove grupe...', botToken)
    
    // Try to get group members using different approaches
    const members = await getAllGroupMembers(groupId, botToken)
    
    if (members.length === 0) {
      await sendMessage(chatId, 
        '❌ *Nije moguće dobiti listu članova*\n\n' +
        'Telegram API ograničava pristup listi članova.\n' +
        'Moguće je da bot nema dovoljne dozvole ili\n' +
        'da grupa ima preveći broj članova.\n\n' +
        'Alternativno, možete koristiti:\n' +
        '• `/check @username` - proverava određenog korisnika\n' +
        '• `/status` - osnovne statistike', botToken)
      return
    }

    // Get usernames from database for comparison
    const { data: usersInDB } = await supabase
      .from('auth_users')
      .select('telegram_username')
    
    const dbUsernames = new Set(usersInDB?.map((u: any) => u.telegram_username?.toLowerCase()) || [])

    // Format member list
    let message = `👥 *ČLANOVI GRUPE* (${members.length})\n\n`
    
    members.forEach((member, index) => {
      const name = member.user.first_name + (member.user.last_name ? ` ${member.user.last_name}` : '')
      const username = member.user.username || 'nema username'
      const id = member.user.id
      const status = member.status
      
      // Check if user is in database
      const inDB = member.user.username && dbUsernames.has(member.user.username.toLowerCase())
      const statusIcon = inDB ? '✅' : (member.user.username ? '❌' : '⚠️')
      
      message += `${index + 1}. ${statusIcon} *${name}*\n`
      message += `   👤 @${username}\n`
      message += `   🆔 ${id}\n`
      message += `   📊 ${status}\n`
      if (!member.user.username) {
        message += `   ⚠️ Nema username\n`
      } else if (!inDB) {
        message += `   ❌ Nije u bazi\n`
      } else {
        message += `   ✅ Verifikovan\n`
      }
      message += '\n'
    })

    // Split message if too long
    const chunks = splitLongMessage(message, 4000)
    if (chunks.length > 1) {
      for (const chunk of chunks) {
        await sendMessage(chatId, chunk, botToken)
        await new Promise(resolve => setTimeout(resolve, 500)) // Delay between messages
      }
    } else {
      await sendMessage(chatId, message, botToken)
    }
    
  } catch (error) {
    console.error('Error in members command:', error)
    await sendMessage(chatId, '❌ Greška pri dobijanju liste članova.', botToken)
  }
}

// Try different methods to get group members
async function getAllGroupMembers(groupId: string, botToken: string): Promise<any[]> {
  // Method 1: Try to get administrators first
  try {
    const adminsResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatAdministrators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: groupId })
    })
    
    const adminsData = await adminsResponse.json()
    
    if (adminsData.ok && adminsData.result.length > 0) {
      console.log('Got administrators:', adminsData.result.length)
      
      // For now, return administrators as it's what we can reliably get
      // Note: Getting all members requires special bot permissions and group settings
      return adminsData.result
    }
  } catch (error) {
    console.error('Error getting administrators:', error)
  }

  // Method 2: Try to get chat members count and inform about limitations
  try {
    const countResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatMemberCount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: groupId })
    })
    
    const countData = await countResponse.json()
    
    if (countData.ok) {
      console.log('Total members in group:', countData.result)
      // We can't get all members, but we know the count
    }
  } catch (error) {
    console.error('Error getting member count:', error)
  }

  return []
}

// Split long messages into chunks
function splitLongMessage(message: string, maxLength: number): string[] {
  const chunks: string[] = []
  let currentChunk = ''
  const lines = message.split('\n')
  
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
    }
    currentChunk += line + '\n'
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

// Check if new member is authorized and kick if not
async function checkAndKickUnauthorizedMember(user: any, chatId: string, supabase: any, botToken: string, groupId: string) {
  try {
    const userId = user.id
    const username = user.username
    const firstName = user.first_name || 'Nepoznato'
    const lastName = user.last_name || ''
    const fullName = (firstName + ' ' + lastName).trim()
    
    // First, check if this user is a bot (including our own bot)
    if (user.is_bot) {
      console.log(`Skipping bot user: ${fullName} (@${username || 'no username'}, ID: ${userId})`)
      return // Don't kick bots
    }
    
    // Additional safety check: get our bot info to avoid self-kick
    try {
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
      const botInfo = await botInfoResponse.json()
      if (botInfo.ok && botInfo.result.id === userId) {
        console.log(`Skipping self (bot ID: ${userId})`)
        return // Don't kick ourselves
      }
    } catch (error) {
      console.log('Could not verify bot identity, but continuing...', error)
    }
    
    // Check if user has username
    if (!username) {
      console.log(`Kicking user without username: ${fullName} (ID: ${userId})`)
      
      // Kick the user
      await kickChatMember(userId, groupId, botToken)
      
      // Send notification to admins
      const kickMessage = `🚫 *KORISNIK IZBAČEN*\n\n` +
        `👤 **Ime:** ${fullName}\n` +
        `🆔 **ID:** ${userId}\n` +
        `👨‍💻 **Username:** nema username\n` +
        `❌ **Razlog:** Nema Telegram username\n\n` +
        `⚠️ Korisnik mora imati Telegram username da bi pristupio grupi.`
      
      await sendMessage(chatId, kickMessage, botToken)
      return
    }
    
    const { data: userInDB } = await supabase
      .from('auth_users')
      .select('telegram_username')
      .eq('telegram_username', username)
      .single()
    
    if (!userInDB) {
      console.log(`Kicking unauthorized user: ${fullName} (@${username}, ID: ${userId})`)
      
      await kickChatMember(userId, groupId, botToken)
      
      const kickMessage = `🚫 *KORISNIK IZBAČEN*\n\n` +
        `👤 **Ime:** ${fullName}\n` +
        `🆔 **ID:** ${userId}\n` +
        `👨‍💻 **Username:** @${username}\n` +
        `❌ **Razlog:** Username nije u bazi podataka\n\n` +
        `⚠️ Korisnik se mora registrovati sa FON email-om da bi pristupio grupi.`
      
      await sendMessage(chatId, kickMessage, botToken)
      return
    }
    
    console.log(`Authorized user joined: ${fullName} (@${username})`)
    
  } catch (error) {
    console.error('Error checking/kicking unauthorized member:', error)
  }
}

// Kick chat member
async function kickChatMember(userId: number, groupId: string, botToken: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/kickChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupId,
        user_id: userId
      })
    })
    
    const data = await response.json()
    
    if (data.ok) {
      console.log(`Successfully kicked user ${userId}`)
    } else {
      console.error(`Failed to kick user ${userId}:`, data.description)
    }
    
    return data.ok
  } catch (error) {
    console.error(`Error kicking user ${userId}:`, error)
    return false
  }
}

// Check if user with username is in the group
async function checkIfUserInGroupByUsername(username: string, groupId: string, botToken: string): Promise<{ inGroup: boolean, userInfo?: any }> {
  try {
    // First, try to get administrators and check if user is among them
    const adminsResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatAdministrators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: groupId })
    })
    
    const adminsData = await adminsResponse.json()
    
    if (adminsData.ok) {
      const foundAdmin = adminsData.result.find((admin: any) => 
        admin.user.username && admin.user.username.toLowerCase() === username.toLowerCase()
      )
      
      if (foundAdmin) {
        return { inGroup: true, userInfo: foundAdmin.user }
      }
    }
    
    // If not found in administrators, we can't easily check all members
    // due to Telegram API limitations, so we'll return unknown status
    return { inGroup: false }
    
  } catch (error) {
    console.error('Error checking group membership by username:', error)
    return { inGroup: false }
  }
}
// Get user ID by username*/