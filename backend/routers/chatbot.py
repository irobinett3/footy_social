"""
Chatbot functionality for fan room live chat.
Integrates AI responses with OpenAI via LangChain and bad word filtering.
"""

import logging
import re
from datetime import datetime
from typing import List, Optional, Dict

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

logger = logging.getLogger(__name__)


class BadWordFilter:
    """Filters inappropriate content from chat messages."""
    
    def __init__(self, badwords: Optional[List[str]] = None, replacement: str = "***"):
        """
        Initialize the bad word filter.
        
        Args:
            badwords: List of words to filter. If None, uses default list.
            replacement: String to replace bad words with.
        """
        self.badwords = badwords or self._default_badwords()
        self.replacement = replacement
        
        # Create case-insensitive regex pattern with word boundaries
        self.pattern = re.compile(
            r'\b(' + '|'.join(map(re.escape, self.badwords)) + r')\b',
            re.IGNORECASE
        )
    
    def _default_badwords(self) -> List[str]:
        """
        Default list of inappropriate words.
        Customize this list for your needs.
        """
        return [
            # Add your bad words here - this is just a starter list
            "damn", "hell", "crap", "sucks",
            # Add more offensive words as needed
            # Consider loading from a file for easier management
        ]
    
    def contains_badwords(self, text: str) -> bool:
        """
        Check if text contains any bad words.
        
        Args:
            text: Text to check
            
        Returns:
            True if bad words are found, False otherwise
        """
        return bool(self.pattern.search(text))
    
    def filter_text(self, text: str) -> str:
        """
        Replace bad words with replacement string.
        
        Args:
            text: Text to filter
            
        Returns:
            Filtered text with bad words replaced
        """
        return self.pattern.sub(self.replacement, text)
    
    def get_violations(self, text: str) -> List[str]:
        """
        Get list of bad words found in text.
        
        Args:
            text: Text to check
            
        Returns:
            List of bad words found
        """
        matches = self.pattern.findall(text)
        return list(set(matches)) if matches else []


class ChatMessage:
    """Represents a message in the chat for bot context."""
    
    def __init__(
        self,
        username: str,
        content: str,
        timestamp: datetime,
        is_bot: bool = False
    ):
        self.username = username
        self.content = content
        self.timestamp = timestamp
        self.is_bot = is_bot
    
    def __repr__(self):
        return f"<ChatMessage {self.username}: {self.content[:30]}...>"


class FootyBot:
    """
    AI-powered chatbot for soccer fan rooms.
    Responds when mentioned, provides soccer knowledge, keeps chat lively.
    """
    
    def __init__(
        self,
        api_key: str,
        bot_name: str = "FootyBot",
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
        max_tokens: int = 300,
        context_window: int = 15
    ):
        """
        Initialize the soccer chatbot.
        
        Args:
            api_key: OpenAI API key
            bot_name: Name of the bot (used for mentions)
            model: OpenAI model to use (gpt-4o-mini is cheap and good)
            temperature: Response creativity (0-1)
            max_tokens: Maximum response length
            context_window: Number of recent messages to consider
        """
        self.bot_name = bot_name
        self.model = model
        self.context_window = context_window
        
        # Initialize LangChain OpenAI
        self.llm = ChatOpenAI(
            api_key=api_key,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Mention triggers - bot responds when these appear in messages
        self.mention_triggers = [
            f"@{bot_name}",
            f"@{bot_name.lower()}",
            "!bot",
            "!footy",
            "hey bot",
        ]
        
        # Store recent messages per room for context
        self.room_history: Dict[int, List[ChatMessage]] = {}
        
        # System prompt defines bot personality
        self.system_prompt = self._create_system_prompt()
        
        # Create prompt template
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self.system_prompt),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}")
        ])
        
        # Create chain
        self.chain = self.prompt | self.llm
    
    def _create_system_prompt(self) -> str:
        """Create the system prompt that defines bot personality."""
        return f"""You are {self.bot_name}, a knowledgeable and enthusiastic soccer chatbot in a live fan chat.

            Your role:
            - Answer questions about soccer: teams, players, tactics, rules, history, statistics
            - Provide match insights and interesting facts
            - Be friendly and conversational with all fans
            - Stay neutral - respect all teams and their supporters
            - Keep responses SHORT (1-3 sentences max) - this is live chat!
            - Be enthusiastic but not excessive

            Style guidelines:
            - Casual and conversational tone
            - Use soccer terminology naturally
            - You can use soccer emojis occasionally: ⚽ 🥅 ⚡ 🔥
            - Never use inappropriate language
            - If you don't know something, admit it honestly
            - Focus on being helpful and informative

            CRITICAL RULES:
            - ONLY respond to direct questions or clear requests for information
            - NEVER respond to general statements, comments, or greetings
            - NEVER ask follow-up questions or engage in back-and-forth conversation
            - Give complete, self-contained answers that don't invite replies
            - If the message isn't a question, don't respond at all

            Current context: You're in a Premier League fan room where supporters are chatting during or about matches.

            Remember: Keep responses BRIEF and ON-TOPIC. Answer the question directly, then stop. No follow-ups!"""
    
    def is_mentioned(self, content: str) -> bool:
        """
        Check if bot is mentioned in the message.
        
        Args:
            content: Message content
            
        Returns:
            True if bot is mentioned, False otherwise
        """
        content_lower = content.lower()
        return any(trigger.lower() in content_lower for trigger in self.mention_triggers)
    
    def add_message_to_history(self, room_id: int, message: ChatMessage) -> None:
        """
        Add a message to room history for context.
        
        Args:
            room_id: Room ID
            message: ChatMessage to add
        """
        if room_id not in self.room_history:
            self.room_history[room_id] = []
        
        self.room_history[room_id].append(message)
        
        # Keep only recent messages
        if len(self.room_history[room_id]) > self.context_window:
            self.room_history[room_id] = self.room_history[room_id][-self.context_window:]
    
    def _get_room_context(self, room_id: int) -> str:
        """
        Format recent chat history as context string.
        
        Args:
            room_id: Room ID
            
        Returns:
            Formatted context string
        """
        messages = self.room_history.get(room_id, [])
        
        if not messages:
            return "No recent chat history."
        
        context_lines = []
        for msg in messages[-10:]:  # Last 10 messages
            time_str = msg.timestamp.strftime("%H:%M")
            context_lines.append(f"[{time_str}] {msg.username}: {msg.content}")
        
        return "\n".join(context_lines)
    
    async def generate_response(
        self,
        room_id: int,
        user_message: str,
        username: str,
        team_name: Optional[str] = None
    ) -> str:
        """
        Generate AI response to user message.
        
        Args:
            room_id: Fan room ID
            user_message: The message content
            username: Username who sent the message
            team_name: Name of the team's fan room (optional)
            
        Returns:
            Bot's response text
        """
        try:
            # Remove mention triggers from the actual question
            question = user_message
            for trigger in self.mention_triggers:
                question = question.replace(trigger, "").strip()
            
            # Get recent chat context
            context = self._get_room_context(room_id)
            
            # Build the prompt with context
            team_context = f"\n\nCurrent room: {team_name} fan room" if team_name else ""
            
            prompt = f"""Recent chat context:
{context}

{username} just asked you: {question}{team_context}

Respond to their question. Remember: 1-3 sentences max, be helpful and engaging!"""
            
            # Get response from OpenAI via LangChain
            response = self.chain.invoke({
                "input": prompt,
                "history": []  # We include context in the prompt instead
            })
            
            return response.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating bot response: {e}")
            return "Sorry, I'm having trouble thinking right now. Try asking again! 🤔"
    
    def clear_room_history(self, room_id: int) -> None:
        """
        Clear chat history for a room.
        
        Args:
            room_id: Room ID to clear
        """
        if room_id in self.room_history:
            self.room_history[room_id] = []
            logger.info(f"Cleared history for room {room_id}")
    
    def set_team_context(self, room_id: int, home_team: str, away_team: str) -> None:
        """
        Update system prompt with current match context.
        Useful for match-specific discussions.
        
        Args:
            room_id: Room ID
            home_team: Home team name
            away_team: Away team name
        """
        # This could be enhanced to store per-room system prompts
        logger.info(f"Match context set for room {room_id}: {home_team} vs {away_team}")


class ChatbotManager:
    """
    Manages bot instances and filtering for the entire application.
    Singleton pattern - one instance shared across all rooms.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChatbotManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.bot: Optional[FootyBot] = None
        self.filter: Optional[BadWordFilter] = None
        self._initialized = True
    
    def initialize(
        self,
        openai_api_key: str,
        badwords: Optional[List[str]] = None,
        bot_name: str = "FootyBot"
    ) -> None:
        """
        Initialize the bot and filter.
        Call this once at application startup.
        
        Args:
            openai_api_key: OpenAI API key
            badwords: Custom bad words list (optional)
            bot_name: Bot display name
        """
        try:
            self.bot = FootyBot(
                api_key=openai_api_key,
                bot_name=bot_name,
                model="gpt-4o-mini",  # Cheap and effective
                temperature=0.7,
                max_tokens=300
            )
            self.filter = BadWordFilter(badwords=badwords)
            logger.info("Chatbot and filter initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize chatbot: {e}")
            raise
    
    def is_initialized(self) -> bool:
        """Check if bot and filter are initialized."""
        return self.bot is not None and self.filter is not None
    
    def check_message(self, content: str) -> tuple[bool, Optional[str]]:
        """
        Check if message contains bad words.
        
        Args:
            content: Message content
            
        Returns:
            Tuple of (is_clean, error_message)
            - is_clean: True if message is clean, False if contains bad words
            - error_message: Error message if not clean, None otherwise
        """
        if not self.filter:
            return True, None
        
        if self.filter.contains_badwords(content):
            violations = self.filter.get_violations(content)
            logger.warning(f"Bad words detected: {violations}")
            return False, "Your message contains inappropriate language and cannot be sent."
        
        return True, None
    
    async def process_message(
        self,
        room_id: int,
        username: str,
        content: str,
        timestamp: datetime,
        team_name: Optional[str] = None
    ) -> Optional[str]:
        """
        Process a chat message and generate bot response if mentioned.
        
        Args:
            room_id: Fan room ID
            username: Username who sent the message
            content: Message content
            timestamp: Message timestamp
            team_name: Team name for the room (optional)
            
        Returns:
            Bot response if bot was mentioned, None otherwise
        """
        if not self.bot:
            return None
        
        # Add message to bot's context
        message = ChatMessage(
            username=username,
            content=content,
            timestamp=timestamp,
            is_bot=False
        )
        self.bot.add_message_to_history(room_id, message)
        
        # Check if bot should respond
        if not self.bot.is_mentioned(content):
            return None
        
        # Generate response
        response = await self.bot.generate_response(
            room_id=room_id,
            user_message=content,
            username=username,
            team_name=team_name
        )
        
        # Add bot's response to context too
        bot_message = ChatMessage(
            username=self.bot.bot_name,
            content=response,
            timestamp=datetime.utcnow(),
            is_bot=True
        )
        self.bot.add_message_to_history(room_id, bot_message)
        
        return response


# Global singleton instance
chatbot_manager = ChatbotManager()


# Convenience functions for easy import
def initialize_chatbot(openai_api_key: str, badwords: Optional[List[str]] = None) -> None:
    """Initialize the global chatbot manager."""
    chatbot_manager.initialize(openai_api_key, badwords)


def check_message_content(content: str) -> tuple[bool, Optional[str]]:
    """Check if message content is appropriate."""
    return chatbot_manager.check_message(content)


async def process_chat_message(
    room_id: int,
    username: str,
    content: str,
    timestamp: datetime,
    team_name: Optional[str] = None
) -> Optional[str]:
    """Process message and get bot response if mentioned."""
    return await chatbot_manager.process_message(
        room_id, username, content, timestamp, team_name
    )